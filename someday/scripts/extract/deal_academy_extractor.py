#!/usr/bin/env python3
"""
Deal Academy Teachable Course Extractor
========================================
Extracts course content from Deal Academy hosted on Teachable platform.

Features:
- Authenticates with Teachable using session cookies
- Extracts course list and structure
- Downloads module/lesson hierarchy
- Extracts text lesson content
- Marks video lessons for Whisper transcription
- Incremental extraction with state persistence
- Rate limiting to respect server resources
- Comprehensive error handling with retry logic

Output Structure:
- Course structure: data/raw/deal_academy/courses/course_{id}_structure.json
- Lesson content: data/raw/deal_academy/lessons/course_{id}_lesson_{nn}.json

Usage:
    export TEACHABLE_EMAIL=your@email.com
    export TEACHABLE_PASSWORD=yourpassword
    python deal_academy_extractor.py --output-dir /path/to/data/raw/deal_academy \\
                                     --state-file /path/to/data/state/deal_academy_state.json \\
                                     --skip-existing

Authentication:
    Requires valid Teachable credentials set as environment variables:
    - TEACHABLE_EMAIL: Your Teachable account email
    - TEACHABLE_PASSWORD: Your Teachable account password

Note:
    This script requires active credentials to access course content.
    Without valid credentials, only the authentication flow can be tested.

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("deal_academy_extractor")

# Constants
EXTRACTOR_VERSION = "1.0.0"
DEFAULT_RATE_LIMIT_DELAY = 2.0  # seconds between requests (respectful)
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 5.0  # seconds between retries
DEFAULT_TIMEOUT = 30  # seconds for HTTP requests

# Teachable configuration
# Update this to the actual Deal Academy school URL
TEACHABLE_SCHOOL_URL = "https://courses.dealmakersinstitute.com"
TEACHABLE_LOGIN_PATH = "/sign_in"
TEACHABLE_COURSES_PATH = "/courses/enrolled"

# User agent to identify the scraper
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


class CourseMetadata(TypedDict, total=False):
    """Type definition for course metadata."""

    course_id: str
    title: str
    description: str
    instructor: str
    thumbnail_url: str
    url: str
    progress_percent: int
    total_lessons: int
    completed_lessons: int
    modules: list[dict[str, Any]]


class LessonMetadata(TypedDict, total=False):
    """Type definition for lesson metadata."""

    lesson_id: str
    course_id: str
    module_id: str
    module_title: str
    title: str
    lesson_type: str  # 'video', 'text', 'quiz', 'download'
    url: str
    position: int
    duration_seconds: int | None
    is_completed: bool
    content: str  # For text lessons
    video_url: str | None  # For video lessons (if extractable)
    attachments: list[dict[str, str]]
    needs_transcription: bool


class ExtractionState(TypedDict):
    """Type definition for extraction state file."""

    source: str
    version: str
    last_updated: str | None
    processed_lesson_ids: list[str]
    failed_lesson_ids: list[str]
    pending_lesson_ids: list[str]
    needs_transcription: list[str]
    processed_course_ids: list[str]
    metadata: dict[str, Any]


@dataclass
class ExtractionResult:
    """Result of extracting a single lesson."""

    lesson_id: str
    success: bool
    lesson_type: str
    lesson_path: Path | None = None
    needs_transcription: bool = False
    error: str | None = None
    skipped_reason: str | None = None


@dataclass
class ExtractionStats:
    """Statistics for the extraction run."""

    total_courses: int = 0
    total_lessons: int = 0
    processed_lessons: int = 0
    skipped_lessons: int = 0
    failed_lessons: int = 0
    video_lessons: int = 0
    text_lessons: int = 0
    results: list[ExtractionResult] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class DealAcademyExtractorError(Exception):
    """Base exception for Deal Academy extractor errors."""

    pass


class AuthenticationError(DealAcademyExtractorError):
    """Raised when authentication fails."""

    pass


class NetworkError(DealAcademyExtractorError):
    """Raised when network requests fail."""

    pass


class ParseError(DealAcademyExtractorError):
    """Raised when HTML parsing fails."""

    pass


class CredentialsNotFoundError(DealAcademyExtractorError):
    """Raised when credentials are not provided."""

    pass


def get_credentials() -> tuple[str, str]:
    """
    Get Teachable credentials from environment variables.

    Returns:
        Tuple of (email, password).

    Raises:
        CredentialsNotFoundError: If credentials are not set.
    """
    email = os.environ.get("TEACHABLE_EMAIL")
    password = os.environ.get("TEACHABLE_PASSWORD")

    if not email or not password:
        raise CredentialsNotFoundError(
            "Teachable credentials not found. Set TEACHABLE_EMAIL and "
            "TEACHABLE_PASSWORD environment variables."
        )

    return email, password


def create_session() -> requests.Session:
    """
    Create a configured requests session.

    Returns:
        Configured requests Session object.
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
    )
    return session


def fetch_page(
    url: str,
    session: requests.Session,
    timeout: int = DEFAULT_TIMEOUT,
    retry_count: int = DEFAULT_RETRY_COUNT,
    retry_delay: float = DEFAULT_RETRY_DELAY,
) -> str:
    """
    Fetch a page with retry logic.

    Args:
        url: URL to fetch.
        session: Requests session.
        timeout: Request timeout in seconds.
        retry_count: Number of retries on failure.
        retry_delay: Delay between retries in seconds.

    Returns:
        HTML content of the page.

    Raises:
        NetworkError: If the page cannot be fetched after retries.
    """
    last_error: Exception | None = None

    for attempt in range(retry_count):
        try:
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or "utf-8"
            return response.text
        except requests.RequestException as e:
            last_error = e
            if attempt < retry_count - 1:
                logger.warning(f"Retry {attempt + 1}/{retry_count} for {url}: {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to fetch {url} after {retry_count} attempts: {e}")

    raise NetworkError(f"Failed to fetch {url}: {last_error}")


def authenticate_teachable(
    session: requests.Session,
    email: str,
    password: str,
    school_url: str = TEACHABLE_SCHOOL_URL,
) -> bool:
    """
    Authenticate with Teachable using form-based login.

    Args:
        session: Requests session to authenticate.
        email: Teachable account email.
        password: Teachable account password.
        school_url: Base URL of the Teachable school.

    Returns:
        True if authentication was successful.

    Raises:
        AuthenticationError: If authentication fails.
    """
    login_url = urljoin(school_url, TEACHABLE_LOGIN_PATH)
    logger.info(f"Authenticating with Teachable at: {login_url}")

    try:
        # Step 1: Fetch login page to get CSRF token
        response = session.get(login_url, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract CSRF token (Teachable uses Rails-style authenticity token)
        csrf_token = None

        # Look for meta tag with csrf-token
        meta_csrf = soup.find("meta", attrs={"name": "csrf-token"})
        if meta_csrf and meta_csrf.get("content"):
            csrf_token = meta_csrf["content"]

        # Fallback: look for hidden input field
        if not csrf_token:
            csrf_input = soup.find("input", attrs={"name": "authenticity_token"})
            if csrf_input and csrf_input.get("value"):
                csrf_token = csrf_input["value"]

        if not csrf_token:
            logger.warning("Could not find CSRF token, attempting login anyway")

        # Step 2: Submit login form
        login_data = {
            "user[email]": email,
            "user[password]": password,
            "commit": "Log In",
        }

        if csrf_token:
            login_data["authenticity_token"] = csrf_token

        # Add headers expected by Teachable
        session.headers.update(
            {
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": school_url,
                "Referer": login_url,
            }
        )

        response = session.post(
            login_url,
            data=login_data,
            timeout=DEFAULT_TIMEOUT,
            allow_redirects=True,
        )

        # Check for successful login
        # Teachable typically redirects to courses page on success
        if response.status_code == 200:
            # Check if we're logged in by looking for logout link or user menu
            soup = BeautifulSoup(response.text, "html.parser")

            # Various indicators of successful login
            logged_in_indicators = [
                soup.find("a", href=re.compile(r"/sign_out|/logout", re.IGNORECASE)),
                soup.find(class_=re.compile(r"user-menu|profile|logout", re.IGNORECASE)),
                soup.find("a", string=re.compile(r"log\s*out|sign\s*out", re.IGNORECASE)),
                # Check if we're on the courses page
                "/courses" in response.url,
            ]

            if any(logged_in_indicators):
                logger.info("Successfully authenticated with Teachable")
                return True

            # Check for login error messages
            error_indicators = [
                soup.find(class_=re.compile(r"error|alert-danger|flash", re.IGNORECASE)),
                soup.find(string=re.compile(r"invalid|incorrect|failed", re.IGNORECASE)),
            ]

            for indicator in error_indicators:
                if indicator:
                    error_text = indicator.get_text(strip=True) if hasattr(indicator, "get_text") else str(indicator)
                    raise AuthenticationError(f"Login failed: {error_text[:100]}")

        raise AuthenticationError(
            f"Authentication failed with status {response.status_code}. "
            "Check credentials and school URL."
        )

    except requests.RequestException as e:
        raise AuthenticationError(f"Network error during authentication: {e}")


def extract_course_list(
    session: requests.Session,
    school_url: str = TEACHABLE_SCHOOL_URL,
) -> list[CourseMetadata]:
    """
    Extract list of enrolled courses from Teachable.

    Args:
        session: Authenticated requests session.
        school_url: Base URL of the Teachable school.

    Returns:
        List of course metadata dictionaries.
    """
    courses_url = urljoin(school_url, TEACHABLE_COURSES_PATH)
    logger.info(f"Fetching course list from: {courses_url}")

    html = fetch_page(courses_url, session)
    soup = BeautifulSoup(html, "html.parser")

    courses: list[CourseMetadata] = []

    # Teachable course cards typically have a common structure
    # Look for course containers
    course_selectors = [
        ("div", {"class": re.compile(r"course-card|course-listing|course-item", re.IGNORECASE)}),
        ("a", {"class": re.compile(r"course-card|course-link", re.IGNORECASE)}),
        ("div", {"data-course-id": True}),
    ]

    course_elements: list[Tag] = []
    for tag, attrs in course_selectors:
        found = soup.find_all(tag, attrs)
        if found:
            course_elements.extend(found)
            break

    # Fallback: look for course links in main content
    if not course_elements:
        main_content = soup.find("main") or soup.find(class_=re.compile(r"content|courses"))
        if main_content:
            course_elements = main_content.find_all("a", href=re.compile(r"/courses/"))

    for element in course_elements:
        course = extract_course_from_element(element, school_url)
        if course and course["course_id"] not in [c["course_id"] for c in courses]:
            courses.append(course)

    logger.info(f"Found {len(courses)} courses")
    return courses


def extract_course_from_element(
    element: Tag,
    school_url: str,
) -> CourseMetadata | None:
    """
    Extract course metadata from a course card element.

    Args:
        element: BeautifulSoup element representing a course.
        school_url: Base URL for resolving relative links.

    Returns:
        Course metadata dictionary, or None if parsing fails.
    """
    # Get course URL
    if element.name == "a":
        course_link = element
    else:
        course_link = element.find("a", href=True)

    if not course_link or not course_link.get("href"):
        return None

    course_url = urljoin(school_url, course_link["href"])

    # Extract course ID from URL
    # Pattern: /courses/enrolled/{course_id} or /courses/{course_id}
    match = re.search(r"/courses/(?:enrolled/)?([^/\?]+)", course_url)
    if not match:
        return None

    course_id = match.group(1)

    # Skip if this is a generic link
    if course_id in ("enrolled", "all", "completed"):
        return None

    # Get title
    title_elem = element.find(class_=re.compile(r"course-title|title|name", re.IGNORECASE))
    if not title_elem:
        title_elem = element.find(["h2", "h3", "h4"])
    if not title_elem:
        title_elem = course_link

    title = clean_html_text(title_elem)
    if not title:
        return None

    # Get description
    desc_elem = element.find(class_=re.compile(r"description|subtitle|summary", re.IGNORECASE))
    description = clean_html_text(desc_elem) if desc_elem else ""

    # Get thumbnail
    img = element.find("img")
    thumbnail_url = None
    if img:
        thumbnail_url = img.get("src") or img.get("data-src")
        if thumbnail_url:
            thumbnail_url = urljoin(school_url, thumbnail_url)

    # Get instructor (if available)
    instructor_elem = element.find(class_=re.compile(r"instructor|author|teacher", re.IGNORECASE))
    instructor = clean_html_text(instructor_elem) if instructor_elem else ""

    # Get progress (if available)
    progress_elem = element.find(class_=re.compile(r"progress|completion", re.IGNORECASE))
    progress_percent = 0
    if progress_elem:
        progress_text = progress_elem.get_text()
        progress_match = re.search(r"(\d+)\s*%", progress_text)
        if progress_match:
            progress_percent = int(progress_match.group(1))

    return {
        "course_id": course_id,
        "title": title,
        "description": description,
        "instructor": instructor,
        "thumbnail_url": thumbnail_url,
        "url": course_url,
        "progress_percent": progress_percent,
        "total_lessons": 0,
        "completed_lessons": 0,
        "modules": [],
    }


def extract_course_structure(
    session: requests.Session,
    course: CourseMetadata,
    school_url: str = TEACHABLE_SCHOOL_URL,
) -> CourseMetadata:
    """
    Extract detailed course structure including modules and lessons.

    Args:
        session: Authenticated requests session.
        course: Basic course metadata.
        school_url: Base URL of the Teachable school.

    Returns:
        Updated course metadata with module/lesson structure.
    """
    course_url = course["url"]
    logger.info(f"Extracting structure for: {course['title']}")

    try:
        html = fetch_page(course_url, session)
    except NetworkError as e:
        logger.error(f"Failed to fetch course page: {e}")
        return course

    soup = BeautifulSoup(html, "html.parser")

    # Look for course curriculum/syllabus section
    curriculum_selectors = [
        ("div", {"class": re.compile(r"curriculum|syllabus|course-content|lessons", re.IGNORECASE)}),
        ("section", {"class": re.compile(r"curriculum|syllabus|sections", re.IGNORECASE)}),
        ("ul", {"class": re.compile(r"curriculum|lessons|sections", re.IGNORECASE)}),
    ]

    curriculum = None
    for tag, attrs in curriculum_selectors:
        curriculum = soup.find(tag, attrs)
        if curriculum:
            break

    if not curriculum:
        # Try looking for lecture/section containers
        curriculum = soup.find(class_=re.compile(r"section-list|lecture-list"))

    if not curriculum:
        logger.warning(f"Could not find curriculum structure for: {course['title']}")
        return course

    # Extract modules/sections
    modules: list[dict[str, Any]] = []
    module_selectors = [
        ("div", {"class": re.compile(r"section(?!-item)|module|chapter", re.IGNORECASE)}),
        ("li", {"class": re.compile(r"section|module|chapter", re.IGNORECASE)}),
    ]

    module_elements: list[Tag] = []
    for tag, attrs in module_selectors:
        found = curriculum.find_all(tag, attrs, recursive=False)
        if found:
            module_elements = found
            break

    # If no modules found, treat entire curriculum as one module
    if not module_elements:
        module_elements = [curriculum]

    total_lessons = 0
    completed_lessons = 0

    for module_idx, module_elem in enumerate(module_elements):
        module = extract_module_from_element(module_elem, course["course_id"], module_idx, school_url)
        if module:
            modules.append(module)
            total_lessons += len(module.get("lessons", []))
            completed_lessons += sum(
                1 for lesson in module.get("lessons", []) if lesson.get("is_completed", False)
            )

    course["modules"] = modules
    course["total_lessons"] = total_lessons
    course["completed_lessons"] = completed_lessons

    logger.info(f"Found {len(modules)} modules with {total_lessons} total lessons")
    return course


def extract_module_from_element(
    element: Tag,
    course_id: str,
    module_idx: int,
    school_url: str,
) -> dict[str, Any] | None:
    """
    Extract module metadata from a module element.

    Args:
        element: BeautifulSoup element representing a module.
        course_id: Parent course ID.
        module_idx: Module position index.
        school_url: Base URL for resolving relative links.

    Returns:
        Module metadata dictionary with lessons.
    """
    # Get module title
    title_elem = element.find(class_=re.compile(r"section-title|module-title|header", re.IGNORECASE))
    if not title_elem:
        title_elem = element.find(["h2", "h3", "h4"])

    title = clean_html_text(title_elem) if title_elem else f"Module {module_idx + 1}"

    # Generate module ID
    module_id = hashlib.md5(f"{course_id}:{title}:{module_idx}".encode()).hexdigest()[:12]

    # Extract lessons
    lessons: list[dict[str, Any]] = []
    lesson_selectors = [
        ("li", {"class": re.compile(r"lesson|lecture|item", re.IGNORECASE)}),
        ("a", {"class": re.compile(r"lesson|lecture", re.IGNORECASE)}),
        ("div", {"class": re.compile(r"lesson-item|lecture-item", re.IGNORECASE)}),
    ]

    lesson_elements: list[Tag] = []
    for tag, attrs in lesson_selectors:
        found = element.find_all(tag, attrs)
        if found:
            lesson_elements = found
            break

    for lesson_idx, lesson_elem in enumerate(lesson_elements):
        lesson = extract_lesson_preview_from_element(
            lesson_elem, course_id, module_id, title, lesson_idx, school_url
        )
        if lesson:
            lessons.append(lesson)

    return {
        "module_id": module_id,
        "title": title,
        "position": module_idx,
        "lessons": lessons,
    }


def extract_lesson_preview_from_element(
    element: Tag,
    course_id: str,
    module_id: str,
    module_title: str,
    lesson_idx: int,
    school_url: str,
) -> dict[str, Any] | None:
    """
    Extract lesson preview metadata from curriculum listing.

    Args:
        element: BeautifulSoup element representing a lesson.
        course_id: Parent course ID.
        module_id: Parent module ID.
        module_title: Parent module title.
        lesson_idx: Lesson position index.
        school_url: Base URL for resolving relative links.

    Returns:
        Lesson preview metadata.
    """
    # Get lesson link
    if element.name == "a":
        lesson_link = element
    else:
        lesson_link = element.find("a", href=True)

    if not lesson_link:
        return None

    lesson_url = lesson_link.get("href")
    if not lesson_url:
        return None

    lesson_url = urljoin(school_url, lesson_url)

    # Extract lesson ID from URL
    # Pattern: /courses/{course_id}/lectures/{lecture_id}
    match = re.search(r"/lectures/(\d+)", lesson_url)
    if match:
        lesson_id = f"lesson_{match.group(1)}"
    else:
        # Generate ID from URL hash
        lesson_id = f"lesson_{hashlib.md5(lesson_url.encode()).hexdigest()[:8]}"

    # Get title
    title_elem = element.find(class_=re.compile(r"title|name|lecture-name", re.IGNORECASE))
    if not title_elem:
        title_elem = lesson_link

    title = clean_html_text(title_elem)
    if not title:
        title = f"Lesson {lesson_idx + 1}"

    # Detect lesson type
    lesson_type = "unknown"
    type_indicators = {
        "video": [r"video|play|watch", element.find("i", class_=re.compile(r"video|play"))],
        "text": [r"text|read|article", element.find("i", class_=re.compile(r"text|file|document"))],
        "quiz": [r"quiz|test|exam", element.find("i", class_=re.compile(r"quiz|question"))],
        "download": [r"download|pdf|attachment", element.find("i", class_=re.compile(r"download|file"))],
    }

    elem_text = element.get_text().lower()
    elem_class = " ".join(element.get("class", []))

    for ltype, (pattern, icon) in type_indicators.items():
        if icon or re.search(pattern, elem_text) or re.search(pattern, elem_class):
            lesson_type = ltype
            break

    # Check completion status
    is_completed = bool(
        element.find(class_=re.compile(r"completed|complete|done|check", re.IGNORECASE))
        or element.get("data-completed")
        or element.find("i", class_=re.compile(r"check|complete"))
    )

    # Get duration if available
    duration_elem = element.find(class_=re.compile(r"duration|time|length", re.IGNORECASE))
    duration_seconds = None
    if duration_elem:
        duration_text = duration_elem.get_text()
        duration_seconds = parse_duration_to_seconds(duration_text)

    return {
        "lesson_id": lesson_id,
        "course_id": course_id,
        "module_id": module_id,
        "module_title": module_title,
        "title": title,
        "lesson_type": lesson_type,
        "url": lesson_url,
        "position": lesson_idx,
        "duration_seconds": duration_seconds,
        "is_completed": is_completed,
    }


def extract_lesson_content(
    session: requests.Session,
    lesson: dict[str, Any],
    school_url: str = TEACHABLE_SCHOOL_URL,
) -> LessonMetadata:
    """
    Extract full lesson content from lesson page.

    Args:
        session: Authenticated requests session.
        lesson: Lesson preview metadata.
        school_url: Base URL of the Teachable school.

    Returns:
        Complete lesson metadata with content.
    """
    lesson_url = lesson["url"]
    logger.debug(f"Extracting lesson: {lesson['title']}")

    result: LessonMetadata = {
        **lesson,
        "content": "",
        "video_url": None,
        "attachments": [],
        "needs_transcription": False,
    }

    try:
        html = fetch_page(lesson_url, session)
    except NetworkError as e:
        logger.error(f"Failed to fetch lesson page: {e}")
        return result

    soup = BeautifulSoup(html, "html.parser")

    # Update lesson type based on actual content
    lesson_type = detect_lesson_type(soup)
    result["lesson_type"] = lesson_type

    # Extract content based on type
    if lesson_type == "video":
        result["video_url"] = extract_video_url(soup)
        result["needs_transcription"] = bool(result["video_url"])

        # Also extract any text content (video description)
        result["content"] = extract_text_content(soup)

    elif lesson_type == "text":
        result["content"] = extract_text_content(soup)

    elif lesson_type == "quiz":
        result["content"] = extract_quiz_content(soup)

    else:
        # Try to extract any available content
        result["content"] = extract_text_content(soup)

    # Extract attachments/downloads
    result["attachments"] = extract_attachments(soup, school_url)

    return result


def detect_lesson_type(soup: BeautifulSoup) -> str:
    """
    Detect lesson type from page content.

    Args:
        soup: BeautifulSoup object of lesson page.

    Returns:
        Lesson type string.
    """
    # Check for video player
    video_indicators = [
        soup.find("video"),
        soup.find("iframe", src=re.compile(r"wistia|vimeo|youtube", re.IGNORECASE)),
        soup.find(class_=re.compile(r"video-player|wistia|vimeo", re.IGNORECASE)),
        soup.find("div", {"data-wistia-id": True}),
    ]

    if any(video_indicators):
        return "video"

    # Check for quiz
    quiz_indicators = [
        soup.find("form", class_=re.compile(r"quiz|assessment", re.IGNORECASE)),
        soup.find(class_=re.compile(r"quiz-container|questions", re.IGNORECASE)),
    ]

    if any(quiz_indicators):
        return "quiz"

    # Default to text
    return "text"


def extract_video_url(soup: BeautifulSoup) -> str | None:
    """
    Extract video URL from lesson page.

    Args:
        soup: BeautifulSoup object of lesson page.

    Returns:
        Video URL if found, None otherwise.
    """
    # Check for Wistia
    wistia_elem = soup.find("div", {"data-wistia-id": True})
    if wistia_elem:
        wistia_id = wistia_elem.get("data-wistia-id")
        return f"wistia:{wistia_id}"

    # Check for Wistia embed script
    wistia_script = soup.find("script", src=re.compile(r"wistia", re.IGNORECASE))
    if wistia_script:
        match = re.search(r"wistia\.com/embed/medias/(\w+)", str(wistia_script))
        if match:
            return f"wistia:{match.group(1)}"

    # Check for Vimeo
    vimeo_iframe = soup.find("iframe", src=re.compile(r"vimeo", re.IGNORECASE))
    if vimeo_iframe:
        src = vimeo_iframe.get("src")
        match = re.search(r"vimeo\.com/(?:video/)?(\d+)", src)
        if match:
            return f"vimeo:{match.group(1)}"

    # Check for YouTube
    youtube_iframe = soup.find("iframe", src=re.compile(r"youtube", re.IGNORECASE))
    if youtube_iframe:
        src = youtube_iframe.get("src")
        match = re.search(r"youtube\.com/embed/([^/?]+)", src)
        if match:
            return f"youtube:{match.group(1)}"

    # Check for direct video element
    video_elem = soup.find("video")
    if video_elem:
        source = video_elem.find("source")
        if source:
            return source.get("src")
        return video_elem.get("src")

    return None


def extract_text_content(soup: BeautifulSoup) -> str:
    """
    Extract text content from lesson page.

    Args:
        soup: BeautifulSoup object of lesson page.

    Returns:
        Cleaned text content.
    """
    # Look for main content container
    content_selectors = [
        ("div", {"class": re.compile(r"lecture-content|lesson-content|text-content", re.IGNORECASE)}),
        ("article", {}),
        ("div", {"class": re.compile(r"fr-view|rich-text|content-body", re.IGNORECASE)}),
        ("main", {}),
    ]

    for tag, attrs in content_selectors:
        container = soup.find(tag, attrs) if attrs else soup.find(tag)
        if container:
            return clean_html_text(container)

    return ""


def extract_quiz_content(soup: BeautifulSoup) -> str:
    """
    Extract quiz questions and structure.

    Args:
        soup: BeautifulSoup object of lesson page.

    Returns:
        Quiz content as text.
    """
    quiz_container = soup.find(class_=re.compile(r"quiz|questions", re.IGNORECASE))
    if not quiz_container:
        return ""

    # Extract questions
    questions: list[str] = []
    question_elems = quiz_container.find_all(class_=re.compile(r"question", re.IGNORECASE))

    for i, q_elem in enumerate(question_elems, 1):
        q_text = clean_html_text(q_elem)
        if q_text:
            questions.append(f"Q{i}: {q_text}")

    return "\n\n".join(questions)


def extract_attachments(soup: BeautifulSoup, school_url: str) -> list[dict[str, str]]:
    """
    Extract downloadable attachments from lesson page.

    Args:
        soup: BeautifulSoup object of lesson page.
        school_url: Base URL for resolving relative links.

    Returns:
        List of attachment dictionaries with name and URL.
    """
    attachments: list[dict[str, str]] = []

    # Look for download links
    download_selectors = [
        ("a", {"class": re.compile(r"download|attachment", re.IGNORECASE)}),
        ("a", {"href": re.compile(r"\.pdf|\.docx?|\.xlsx?|\.zip", re.IGNORECASE)}),
    ]

    for tag, attrs in download_selectors:
        links = soup.find_all(tag, attrs)
        for link in links:
            href = link.get("href")
            if not href:
                continue

            name = clean_html_text(link) or Path(urlparse(href).path).name
            url = urljoin(school_url, href)

            if url not in [a["url"] for a in attachments]:
                attachments.append({"name": name, "url": url})

    return attachments


def clean_html_text(element: Tag | NavigableString | None) -> str:
    """
    Clean HTML text content.

    Args:
        element: BeautifulSoup element.

    Returns:
        Cleaned text content.
    """
    if element is None:
        return ""

    if isinstance(element, NavigableString):
        return str(element).strip()

    # Remove unwanted elements
    for tag in element.find_all(["script", "style", "nav", "footer", "aside", "header"]):
        tag.decompose()

    # Remove hidden elements
    for tag in element.find_all(attrs={"style": re.compile(r"display:\s*none", re.IGNORECASE)}):
        tag.decompose()

    # Get text and normalize whitespace
    text = element.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def parse_duration_to_seconds(duration_text: str | None) -> int | None:
    """
    Parse duration text to seconds.

    Args:
        duration_text: Duration string (e.g., "5:30", "1h 30m").

    Returns:
        Duration in seconds, or None if parsing fails.
    """
    if not duration_text:
        return None

    duration_text = duration_text.strip()

    # Try MM:SS or HH:MM:SS format
    parts = duration_text.split(":")
    try:
        if len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
    except ValueError:
        pass

    # Try Xh Ym format
    hours = minutes = 0
    hour_match = re.search(r"(\d+)\s*h", duration_text, re.IGNORECASE)
    min_match = re.search(r"(\d+)\s*m", duration_text, re.IGNORECASE)

    if hour_match or min_match:
        if hour_match:
            hours = int(hour_match.group(1))
        if min_match:
            minutes = int(min_match.group(1))
        return hours * 3600 + minutes * 60

    return None


def load_state(state_file: Path) -> ExtractionState:
    """
    Load extraction state from file.

    Args:
        state_file: Path to state file.

    Returns:
        Extraction state dictionary.
    """
    default_state: ExtractionState = {
        "source": "deal_academy",
        "version": EXTRACTOR_VERSION,
        "last_updated": None,
        "processed_lesson_ids": [],
        "failed_lesson_ids": [],
        "pending_lesson_ids": [],
        "needs_transcription": [],
        "processed_course_ids": [],
        "metadata": {
            "school_url": TEACHABLE_SCHOOL_URL,
            "extraction_method": "teachable_web",
        },
    }

    if not state_file.exists():
        return default_state

    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
            # Ensure all required keys exist
            for key in default_state:
                if key not in state:
                    state[key] = default_state[key]
            return state
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to load state file, using defaults: {e}")
        return default_state


def save_state(state: ExtractionState, state_file: Path) -> None:
    """
    Save extraction state to file.

    Args:
        state: Extraction state dictionary.
        state_file: Path to state file.
    """
    state["last_updated"] = datetime.now(timezone.utc).isoformat()

    # Ensure parent directory exists
    state_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        logger.debug(f"Saved state to {state_file}")
    except Exception as e:
        logger.error(f"Failed to save state: {e}")


def save_course_structure(
    course: CourseMetadata,
    output_dir: Path,
) -> Path:
    """
    Save course structure to JSON file.

    Args:
        course: Course metadata with structure.
        output_dir: Output directory.

    Returns:
        Path to saved file.
    """
    courses_dir = output_dir / "courses"
    courses_dir.mkdir(parents=True, exist_ok=True)

    output_path = courses_dir / f"course_{course['course_id']}_structure.json"

    course_data = {
        **course,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(course_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved course structure: {output_path}")
    return output_path


def save_lesson_content(
    lesson: LessonMetadata,
    lesson_position: int,
    output_dir: Path,
) -> Path:
    """
    Save lesson content to JSON file.

    Args:
        lesson: Lesson metadata with content.
        lesson_position: Overall lesson position for naming.
        output_dir: Output directory.

    Returns:
        Path to saved file.
    """
    lessons_dir = output_dir / "lessons"
    lessons_dir.mkdir(parents=True, exist_ok=True)

    # Format: course_{id}_lesson_{nn}.json
    filename = f"course_{lesson['course_id']}_lesson_{lesson_position:02d}.json"
    output_path = lessons_dir / filename

    lesson_data = {
        **lesson,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(lesson_data, f, indent=2, ensure_ascii=False)

    return output_path


def run_extraction(
    output_dir: Path,
    state_file: Path,
    skip_existing: bool = True,
    rate_limit_delay: float = DEFAULT_RATE_LIMIT_DELAY,
    limit_courses: int | None = None,
    limit_lessons: int | None = None,
    verbose: bool = False,
    school_url: str = TEACHABLE_SCHOOL_URL,
) -> ExtractionStats:
    """
    Run the full extraction process.

    Args:
        output_dir: Base output directory.
        state_file: Path to state file.
        skip_existing: Skip already processed lessons.
        rate_limit_delay: Delay between requests in seconds.
        limit_courses: Maximum number of courses to process.
        limit_lessons: Maximum number of lessons per course.
        verbose: Enable verbose logging.
        school_url: Teachable school URL.

    Returns:
        ExtractionStats with results and statistics.
    """
    stats = ExtractionStats()

    # Get credentials
    try:
        email, password = get_credentials()
    except CredentialsNotFoundError as e:
        logger.error(str(e))
        stats.errors.append({"error": str(e)})
        return stats

    # Create session and authenticate
    session = create_session()

    try:
        authenticated = authenticate_teachable(session, email, password, school_url)
        if not authenticated:
            raise AuthenticationError("Authentication returned False")
    except AuthenticationError as e:
        logger.error(f"Authentication failed: {e}")
        stats.errors.append({"error": str(e)})
        return stats

    # Load state
    state = load_state(state_file)
    state["metadata"]["school_url"] = school_url

    # Get course list
    try:
        courses = extract_course_list(session, school_url)
    except Exception as e:
        logger.error(f"Failed to get course list: {e}")
        stats.errors.append({"error": str(e)})
        return stats

    if limit_courses and len(courses) > limit_courses:
        courses = courses[:limit_courses]

    stats.total_courses = len(courses)

    if not courses:
        logger.warning("No courses found")
        return stats

    # Process each course
    processed_lessons_set = set(state["processed_lesson_ids"])
    lesson_position = 0

    for course in courses:
        logger.info(f"\nProcessing course: {course['title']}")

        # Extract course structure
        try:
            course = extract_course_structure(session, course, school_url)
        except Exception as e:
            logger.error(f"Failed to extract course structure: {e}")
            stats.errors.append({"course_id": course["course_id"], "error": str(e)})
            continue

        # Save course structure
        save_course_structure(course, output_dir)
        state["processed_course_ids"].append(course["course_id"])

        # Collect all lessons from all modules
        all_lessons: list[dict[str, Any]] = []
        for module in course.get("modules", []):
            all_lessons.extend(module.get("lessons", []))

        stats.total_lessons += len(all_lessons)

        if limit_lessons and len(all_lessons) > limit_lessons:
            all_lessons = all_lessons[:limit_lessons]

        # Process each lesson
        for lesson in all_lessons:
            lesson_id = lesson["lesson_id"]
            lesson_position += 1

            # Skip if already processed
            if skip_existing and lesson_id in processed_lessons_set:
                logger.debug(f"Skipping already processed: {lesson_id}")
                stats.skipped_lessons += 1
                continue

            logger.info(f"  [{lesson_position}] {lesson['title']}")

            try:
                # Extract lesson content
                lesson_content = extract_lesson_content(session, lesson, school_url)

                # Save lesson content
                lesson_path = save_lesson_content(lesson_content, lesson_position, output_dir)

                result = ExtractionResult(
                    lesson_id=lesson_id,
                    success=True,
                    lesson_type=lesson_content["lesson_type"],
                    lesson_path=lesson_path,
                    needs_transcription=lesson_content.get("needs_transcription", False),
                )

                # Update state
                state["processed_lesson_ids"].append(lesson_id)
                if lesson_id in state["failed_lesson_ids"]:
                    state["failed_lesson_ids"].remove(lesson_id)

                if result.needs_transcription:
                    state["needs_transcription"].append(lesson_id)
                    stats.video_lessons += 1
                else:
                    stats.text_lessons += 1

                stats.processed_lessons += 1
                logger.info(f"    Type: {lesson_content['lesson_type']}, Saved: {lesson_path.name}")

            except Exception as e:
                logger.error(f"    Failed: {e}")
                result = ExtractionResult(
                    lesson_id=lesson_id,
                    success=False,
                    lesson_type=lesson.get("lesson_type", "unknown"),
                    error=str(e),
                )

                if lesson_id not in state["failed_lesson_ids"]:
                    state["failed_lesson_ids"].append(lesson_id)
                stats.failed_lessons += 1
                stats.errors.append({"lesson_id": lesson_id, "error": str(e)})

            stats.results.append(result)

            # Save state periodically
            if stats.processed_lessons % 5 == 0:
                save_state(state, state_file)

            # Rate limiting
            time.sleep(rate_limit_delay)

    # Final state save
    save_state(state, state_file)

    return stats


def print_summary(stats: ExtractionStats) -> None:
    """Print extraction summary to stdout."""
    print("\n" + "=" * 60)
    print("DEAL ACADEMY EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total courses:         {stats.total_courses}")
    print(f"Total lessons:         {stats.total_lessons}")
    print(f"Processed lessons:     {stats.processed_lessons}")
    print(f"  - Video lessons:     {stats.video_lessons}")
    print(f"  - Text lessons:      {stats.text_lessons}")
    print(f"Skipped (existing):    {stats.skipped_lessons}")
    print(f"Failed:                {stats.failed_lessons}")

    if stats.video_lessons > 0:
        print(f"\nVideo lessons have been marked for transcription.")
        print("Use Whisper or similar to transcribe audio from video lessons.")

    if stats.errors:
        print("\n" + "-" * 60)
        print("ERRORS")
        print("-" * 60)
        for err in stats.errors[:10]:
            if "lesson_id" in err:
                print(f"  [{err['lesson_id']}] {err['error']}")
            elif "course_id" in err:
                print(f"  [COURSE] {err['course_id']}: {err['error']}")
            else:
                print(f"  {err['error']}")
        if len(stats.errors) > 10:
            print(f"  ... and {len(stats.errors) - 10} more errors")

    print()


def main() -> int:
    """Main entry point for the Deal Academy extractor CLI."""
    parser = argparse.ArgumentParser(
        description="Extract course content from Deal Academy on Teachable platform.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Set credentials first
  export TEACHABLE_EMAIL=your@email.com
  export TEACHABLE_PASSWORD=yourpassword

  # Basic extraction
  python deal_academy_extractor.py

  # With custom paths
  python deal_academy_extractor.py --output-dir ./data/raw/deal_academy \\
                                   --state-file ./data/state/deal_academy_state.json

  # Limit extraction scope
  python deal_academy_extractor.py --limit-courses 1 --limit-lessons 5

  # Re-process all (ignore state)
  python deal_academy_extractor.py --no-skip-existing

Output Structure:
  {output-dir}/courses/course_{id}_structure.json - Course structure
  {output-dir}/lessons/course_{id}_lesson_{nn}.json - Lesson content

Environment Variables:
  TEACHABLE_EMAIL    - Your Teachable account email
  TEACHABLE_PASSWORD - Your Teachable account password

Note:
  This script requires valid Teachable credentials to access course content.
  Video lessons are marked for transcription but audio is not downloaded.
  Use Whisper or similar tools to transcribe video content.
        """,
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw/deal_academy"),
        help="Output directory for extracted content (default: data/raw/deal_academy)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("data/state/deal_academy_state.json"),
        help="State file for tracking processed lessons (default: data/state/deal_academy_state.json)",
    )

    parser.add_argument(
        "--school-url",
        type=str,
        default=TEACHABLE_SCHOOL_URL,
        help=f"Teachable school URL (default: {TEACHABLE_SCHOOL_URL})",
    )

    parser.add_argument(
        "--limit-courses",
        type=int,
        default=None,
        help="Maximum number of courses to process (default: all)",
    )

    parser.add_argument(
        "--limit-lessons",
        type=int,
        default=None,
        help="Maximum number of lessons per course (default: all)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip already processed lessons (default: True)",
    )

    parser.add_argument(
        "--no-skip-existing",
        action="store_false",
        dest="skip_existing",
        help="Re-process all lessons, ignoring state",
    )

    parser.add_argument(
        "--rate-limit",
        type=float,
        default=DEFAULT_RATE_LIMIT_DELAY,
        help=f"Delay between requests in seconds (default: {DEFAULT_RATE_LIMIT_DELAY})",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress non-error output",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Test authentication only, do not extract content",
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    elif args.quiet:
        logger.setLevel(logging.ERROR)

    # Resolve paths
    output_dir = args.output_dir.resolve()
    state_file = args.state_file.resolve()

    # Handle dry run mode (test authentication only)
    if args.dry_run:
        logger.info("Dry run mode: Testing authentication only")
        try:
            email, password = get_credentials()
            session = create_session()
            authenticated = authenticate_teachable(session, email, password, args.school_url)
            if authenticated:
                print("Authentication successful!")
                print(f"School URL: {args.school_url}")

                # Try to get course list
                courses = extract_course_list(session, args.school_url)
                print(f"Found {len(courses)} courses:")
                for course in courses[:5]:
                    print(f"  - {course['title']}")
                if len(courses) > 5:
                    print(f"  ... and {len(courses) - 5} more")
                return 0
        except (CredentialsNotFoundError, AuthenticationError) as e:
            logger.error(str(e))
            return 1
        except Exception as e:
            logger.exception(f"Error during dry run: {e}")
            return 1

    # Run extraction
    try:
        stats = run_extraction(
            output_dir=output_dir,
            state_file=state_file,
            skip_existing=args.skip_existing,
            rate_limit_delay=args.rate_limit,
            limit_courses=args.limit_courses,
            limit_lessons=args.limit_lessons,
            verbose=args.verbose,
            school_url=args.school_url,
        )
    except KeyboardInterrupt:
        logger.info("Extraction interrupted by user")
        return 130
    except Exception as e:
        logger.exception(f"Extraction failed: {e}")
        return 1

    # Print summary
    if not args.quiet:
        print_summary(stats)

    # Return exit code based on results
    if stats.failed_lessons > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
