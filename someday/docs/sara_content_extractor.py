#!/usr/bin/env python3
"""
Sara Sharp Content Extractor
============================
Extracts content from multiple sources to build a unified knowledge base for RAG.

Sources:
1. YouTube channel transcripts (@dealmakerseta)
2. Podcast RSS feeds (Dealmakers/Acquisitive)
3. Book (PDF extraction)
4. SK&S Law Blog articles
5. LinkedIn posts (requires credentials or manual export)
6. Media articles (web scraping)

Output: JSON + Markdown files ready for vector database ingestion

Usage:
    python sara_content_extractor.py --all
    python sara_content_extractor.py --youtube
    python sara_content_extractor.py --blog
    python sara_content_extractor.py --book path/to/book.pdf
"""

import os
import re
import json
import subprocess
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional
import argparse

# Third-party imports
import requests
from bs4 import BeautifulSoup
import feedparser

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("Warning: PyMuPDF not available. PDF extraction disabled.")


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    "youtube_channel": "https://www.youtube.com/@dealmakerseta",
    "youtube_channel_id": "@dealmakerseta",
    "blog_url": "https://www.skandslegal.com/sks-blog",
    "deal_academy_url": "https://www.dealacademy.org",
    "linkedin_profile": "https://www.linkedin.com/in/sara-sharp-9a2a98b",
    "output_dir": "./sara_knowledge_base",
    "transcript_dir": "./transcripts",
    
    # Podcast feeds to try
    "podcast_feeds": [
        # Add RSS feed URLs here when discovered
        # "https://feeds.example.com/dealmakers"
    ],
    
    # Media outlets where Sara has been quoted
    "media_sources": [
        "site:usnews.com sara sharp attorney",
        "site:businessinsider.com sara sharp",
        "site:yahoo.com/finance sara sharp attorney",
        "site:gobankingrates.com sara sharp",
    ]
}


# =============================================================================
# UTILITIES
# =============================================================================

def ensure_dirs():
    """Create output directories if they don't exist."""
    Path(CONFIG["output_dir"]).mkdir(parents=True, exist_ok=True)
    Path(CONFIG["transcript_dir"]).mkdir(parents=True, exist_ok=True)


def generate_id(text: str) -> str:
    """Generate a unique ID from text content."""
    return hashlib.md5(text.encode()).hexdigest()[:12]


def clean_text(text: str) -> str:
    """Clean extracted text - remove extra whitespace, fix encoding issues."""
    if not text:
        return ""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove common VTT artifacts
    text = re.sub(r'<[^>]+>', '', text)  # HTML tags
    text = re.sub(r'\[.*?\]', '', text)  # Bracketed text like [Music]
    return text.strip()


def save_json(data: dict, filename: str):
    """Save data to JSON file."""
    filepath = Path(CONFIG["output_dir"]) / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    print(f"Saved: {filepath}")


def save_markdown(content: str, filename: str):
    """Save content to Markdown file."""
    filepath = Path(CONFIG["output_dir"]) / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved: {filepath}")


# =============================================================================
# YOUTUBE EXTRACTION
# =============================================================================

def extract_youtube_transcripts() -> list[dict]:
    """
    Extract transcripts from all videos on Sara's YouTube channel.
    Uses yt-dlp to download auto-generated or manual captions.
    """
    print("\n" + "="*60)
    print("EXTRACTING YOUTUBE TRANSCRIPTS")
    print("="*60)
    
    ensure_dirs()
    transcripts = []
    
    # First, get list of all videos
    print(f"Fetching video list from {CONFIG['youtube_channel']}...")
    
    try:
        # Get video metadata without downloading
        # Note: --no-check-certificate may be needed in some environments
        result = subprocess.run([
            "yt-dlp",
            "--flat-playlist",
            "--dump-json",
            "--no-check-certificate",  # Workaround for SSL issues
            CONFIG["youtube_channel"]
        ], capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"Error fetching video list: {result.stderr}")
            return transcripts
        
        # Parse video metadata
        videos = []
        for line in result.stdout.strip().split('\n'):
            if line:
                try:
                    video = json.loads(line)
                    videos.append(video)
                except json.JSONDecodeError:
                    continue
        
        print(f"Found {len(videos)} videos")
        
        # Download transcripts for each video
        for i, video in enumerate(videos):
            video_id = video.get('id', video.get('url', ''))
            title = video.get('title', 'Unknown')
            
            print(f"\n[{i+1}/{len(videos)}] Processing: {title[:50]}...")
            
            # Download subtitles
            transcript_path = Path(CONFIG["transcript_dir"]) / f"{video_id}"
            
            try:
                sub_result = subprocess.run([
                    "yt-dlp",
                    "--write-auto-sub",
                    "--write-sub",
                    "--sub-lang", "en",
                    "--skip-download",
                    "--sub-format", "vtt/srt/best",
                    "--no-check-certificate",  # Workaround for SSL issues
                    "-o", str(transcript_path),
                    f"https://www.youtube.com/watch?v={video_id}"
                ], capture_output=True, text=True, timeout=120)
                
                # Find the downloaded subtitle file
                vtt_files = list(Path(CONFIG["transcript_dir"]).glob(f"{video_id}*.vtt"))
                srt_files = list(Path(CONFIG["transcript_dir"]).glob(f"{video_id}*.srt"))
                
                sub_file = (vtt_files + srt_files)[0] if (vtt_files or srt_files) else None
                
                if sub_file:
                    transcript_text = parse_subtitle_file(sub_file)
                    if transcript_text:
                        transcripts.append({
                            "id": generate_id(video_id),
                            "source": "youtube",
                            "source_type": "video_transcript",
                            "video_id": video_id,
                            "title": title,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "upload_date": video.get('upload_date', ''),
                            "duration": video.get('duration', 0),
                            "content": transcript_text,
                            "word_count": len(transcript_text.split()),
                            "extracted_at": datetime.now().isoformat()
                        })
                        print(f"  -> Extracted {len(transcript_text.split())} words")
                else:
                    print(f"  -> No subtitles available")
                    
            except subprocess.TimeoutExpired:
                print(f"  -> Timeout downloading subtitles")
            except Exception as e:
                print(f"  -> Error: {e}")
    
    except subprocess.TimeoutExpired:
        print("Timeout fetching video list")
    except Exception as e:
        print(f"Error: {e}")
    
    print(f"\nExtracted {len(transcripts)} transcripts")
    return transcripts


def parse_subtitle_file(filepath: Path) -> str:
    """Parse VTT or SRT subtitle file and extract clean text."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove VTT header
        content = re.sub(r'^WEBVTT\n.*?\n\n', '', content, flags=re.DOTALL)
        
        # Remove timestamps (VTT format: 00:00:00.000 --> 00:00:00.000)
        content = re.sub(r'\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}', '', content)
        
        # Remove SRT timestamps and numbers
        content = re.sub(r'^\d+\s*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}', '', content)
        
        # Remove positioning info
        content = re.sub(r'align:start position:\d+%', '', content)
        content = re.sub(r'<c>|</c>', '', content)
        
        # Clean up
        content = clean_text(content)
        
        # Remove duplicate lines (common in auto-captions)
        lines = content.split('.')
        seen = set()
        unique_lines = []
        for line in lines:
            line = line.strip()
            if line and line not in seen:
                seen.add(line)
                unique_lines.append(line)
        
        return '. '.join(unique_lines)
        
    except Exception as e:
        print(f"Error parsing subtitle file {filepath}: {e}")
        return ""


# =============================================================================
# PODCAST EXTRACTION
# =============================================================================

def extract_podcast_episodes() -> list[dict]:
    """
    Extract podcast episodes from RSS feeds.
    Note: Audio transcription requires Whisper or external service.
    """
    print("\n" + "="*60)
    print("EXTRACTING PODCAST METADATA")
    print("="*60)
    
    episodes = []
    
    # Try to find podcast RSS feeds
    potential_feeds = [
        "https://anchor.fm/s/dealmakers-podcast/podcast/rss",
        "https://feeds.buzzsprout.com/dealmakers.rss",
        # Add more potential feeds
    ]
    
    for feed_url in CONFIG["podcast_feeds"] + potential_feeds:
        try:
            print(f"Trying feed: {feed_url}")
            feed = feedparser.parse(feed_url)
            
            if feed.entries:
                print(f"Found {len(feed.entries)} episodes")
                
                for entry in feed.entries:
                    episodes.append({
                        "id": generate_id(entry.get('id', entry.get('link', ''))),
                        "source": "podcast",
                        "source_type": "podcast_episode",
                        "title": entry.get('title', ''),
                        "url": entry.get('link', ''),
                        "published": entry.get('published', ''),
                        "summary": clean_text(entry.get('summary', '')),
                        "duration": entry.get('itunes_duration', ''),
                        "audio_url": next(
                            (enc.get('href') for enc in entry.get('enclosures', []) 
                             if 'audio' in enc.get('type', '')),
                            None
                        ),
                        "needs_transcription": True,
                        "extracted_at": datetime.now().isoformat()
                    })
        except Exception as e:
            print(f"  -> Error: {e}")
    
    print(f"\nFound {len(episodes)} podcast episodes")
    print("Note: Audio files need transcription via Whisper or external service")
    
    return episodes


# =============================================================================
# BLOG EXTRACTION
# =============================================================================

def extract_blog_articles() -> list[dict]:
    """
    Extract articles from SK&S Law Group blog.
    """
    print("\n" + "="*60)
    print("EXTRACTING BLOG ARTICLES")
    print("="*60)
    
    articles = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)'
    }
    
    try:
        # Fetch blog index page
        response = requests.get(CONFIG["blog_url"], headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find article links (adjust selectors based on actual site structure)
        article_links = soup.find_all('a', href=True)
        blog_urls = set()
        
        for link in article_links:
            href = link['href']
            if '/sks-blog/' in href and href != CONFIG["blog_url"]:
                if href.startswith('/'):
                    href = f"https://www.skandslegal.com{href}"
                blog_urls.add(href)
        
        print(f"Found {len(blog_urls)} blog article links")
        
        # Fetch each article
        for url in blog_urls:
            try:
                print(f"Fetching: {url[:60]}...")
                art_response = requests.get(url, headers=headers, timeout=30)
                art_response.raise_for_status()
                
                art_soup = BeautifulSoup(art_response.text, 'html.parser')
                
                # Extract title
                title_elem = art_soup.find('h1') or art_soup.find('title')
                title = title_elem.get_text(strip=True) if title_elem else url.split('/')[-1]
                
                # Extract main content (adjust selector based on site structure)
                content_elem = (
                    art_soup.find('article') or 
                    art_soup.find('div', class_='blog-content') or
                    art_soup.find('div', class_='post-content') or
                    art_soup.find('main')
                )
                
                if content_elem:
                    # Remove script and style elements
                    for elem in content_elem.find_all(['script', 'style', 'nav', 'footer']):
                        elem.decompose()
                    
                    content = clean_text(content_elem.get_text(separator=' '))
                    
                    if len(content) > 100:  # Filter out empty/navigation pages
                        articles.append({
                            "id": generate_id(url),
                            "source": "blog",
                            "source_type": "blog_article",
                            "title": title,
                            "url": url,
                            "content": content,
                            "word_count": len(content.split()),
                            "extracted_at": datetime.now().isoformat()
                        })
                        print(f"  -> Extracted {len(content.split())} words")
                        
            except Exception as e:
                print(f"  -> Error: {e}")
                
    except Exception as e:
        print(f"Error fetching blog: {e}")
    
    print(f"\nExtracted {len(articles)} blog articles")
    return articles


# =============================================================================
# BOOK/PDF EXTRACTION
# =============================================================================

def extract_book_pdf(pdf_path: str) -> list[dict]:
    """
    Extract text content from PDF book.
    Chunks by chapter/section for better RAG retrieval.
    """
    print("\n" + "="*60)
    print("EXTRACTING BOOK CONTENT")
    print("="*60)
    
    if not PYMUPDF_AVAILABLE:
        print("PyMuPDF not installed. Run: pip install pymupdf")
        return []
    
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return []
    
    chunks = []
    
    try:
        doc = fitz.open(pdf_path)
        print(f"Opened PDF: {pdf_path}")
        print(f"Pages: {len(doc)}")
        
        full_text = []
        current_chapter = "Introduction"
        chapter_content = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # Detect chapter headings (adjust patterns based on actual book)
            chapter_match = re.search(
                r'^(Chapter\s+\d+[:\.]?\s*.+|CHAPTER\s+\d+[:\.]?\s*.+|Part\s+\d+[:\.]?\s*.+)',
                text,
                re.MULTILINE
            )
            
            if chapter_match:
                # Save previous chapter
                if chapter_content:
                    content = clean_text(' '.join(chapter_content))
                    if len(content) > 100:
                        chunks.append({
                            "id": generate_id(f"book-{current_chapter}"),
                            "source": "book",
                            "source_type": "book_chapter",
                            "title": current_chapter,
                            "content": content,
                            "word_count": len(content.split()),
                            "page_start": page_num - len(chapter_content) + 1,
                            "page_end": page_num,
                            "extracted_at": datetime.now().isoformat()
                        })
                
                current_chapter = chapter_match.group(1).strip()
                chapter_content = [text]
            else:
                chapter_content.append(text)
            
            full_text.append(text)
        
        # Don't forget last chapter
        if chapter_content:
            content = clean_text(' '.join(chapter_content))
            if len(content) > 100:
                chunks.append({
                    "id": generate_id(f"book-{current_chapter}"),
                    "source": "book",
                    "source_type": "book_chapter",
                    "title": current_chapter,
                    "content": content,
                    "word_count": len(content.split()),
                    "extracted_at": datetime.now().isoformat()
                })
        
        doc.close()
        
        # Also save full text
        full_content = clean_text(' '.join(full_text))
        chunks.append({
            "id": generate_id("book-full"),
            "source": "book",
            "source_type": "book_full",
            "title": "Complete Book",
            "content": full_content,
            "word_count": len(full_content.split()),
            "total_pages": len(doc),
            "extracted_at": datetime.now().isoformat()
        })
        
        print(f"\nExtracted {len(chunks)} chunks from book")
        print(f"Total words: {len(full_content.split())}")
        
    except Exception as e:
        print(f"Error extracting PDF: {e}")
    
    return chunks


# =============================================================================
# LINKEDIN EXTRACTION (Manual/API)
# =============================================================================

def extract_linkedin_posts(export_file: Optional[str] = None) -> list[dict]:
    """
    Extract LinkedIn posts.
    
    Options:
    1. Manual export: Download from LinkedIn and provide CSV/JSON file
    2. API: Use LinkedIn API with OAuth credentials
    3. Third-party: Use tools like PhantomBuster (requires credentials)
    """
    print("\n" + "="*60)
    print("LINKEDIN EXTRACTION")
    print("="*60)
    
    posts = []
    
    if export_file and os.path.exists(export_file):
        print(f"Loading from export file: {export_file}")
        
        try:
            if export_file.endswith('.json'):
                with open(export_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for item in data:
                        posts.append({
                            "id": generate_id(item.get('id', str(len(posts)))),
                            "source": "linkedin",
                            "source_type": "linkedin_post",
                            "content": clean_text(item.get('content', item.get('text', ''))),
                            "date": item.get('date', item.get('created_at', '')),
                            "url": item.get('url', ''),
                            "engagement": item.get('likes', 0) + item.get('comments', 0),
                            "extracted_at": datetime.now().isoformat()
                        })
            elif export_file.endswith('.csv'):
                import csv
                with open(export_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        content = row.get('Content', row.get('text', row.get('post', '')))
                        if content:
                            posts.append({
                                "id": generate_id(content[:100]),
                                "source": "linkedin",
                                "source_type": "linkedin_post",
                                "content": clean_text(content),
                                "date": row.get('Date', row.get('created_at', '')),
                                "extracted_at": datetime.now().isoformat()
                            })
        except Exception as e:
            print(f"Error loading export file: {e}")
    else:
        print("""
LinkedIn posts require one of these approaches:

1. MANUAL EXPORT (Easiest):
   - Go to LinkedIn Settings > Data Privacy > Get a copy of your data
   - Request "Posts" data
   - Download and provide the file path

2. API ACCESS (Requires Developer Account):
   - Register at https://developer.linkedin.com
   - Create an app and get OAuth credentials
   - Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET env vars

3. PHANTOMBUSTER (Third-party):
   - Sign up at phantombuster.com
   - Use "LinkedIn Activity Extractor" phantom
   - Export results and provide file path

Run with: python sara_content_extractor.py --linkedin path/to/export.json
        """)
    
    print(f"\nExtracted {len(posts)} LinkedIn posts")
    return posts


# =============================================================================
# DEAL ACADEMY COURSE EXTRACTION
# =============================================================================

def extract_deal_academy(credentials: Optional[dict] = None) -> list[dict]:
    """
    Extract content from Deal Academy (Teachable platform).
    Requires login credentials.
    """
    print("\n" + "="*60)
    print("DEAL ACADEMY EXTRACTION")
    print("="*60)
    
    content = []
    
    if not credentials:
        print("""
Deal Academy content requires Teachable login credentials.

Provide credentials via:
1. Environment variables:
   TEACHABLE_EMAIL=your@email.com
   TEACHABLE_PASSWORD=yourpassword

2. Or pass directly:
   python sara_content_extractor.py --deal-academy --email your@email.com --password yourpassword

The script will:
- Log into deal-academy.teachable.com
- Extract course outlines, lesson content, and transcripts
- Save structured content for RAG
        """)
        return content
    
    # Teachable login and extraction would go here
    # This requires session handling and careful scraping
    print("Teachable extraction requires implementation based on course structure")
    
    return content


# =============================================================================
# MAIN ORCHESTRATION
# =============================================================================

def build_knowledge_base(
    youtube: bool = False,
    blog: bool = False,
    book_path: Optional[str] = None,
    linkedin_export: Optional[str] = None,
    podcast: bool = False,
    deal_academy_creds: Optional[dict] = None,
    all_sources: bool = False
) -> dict:
    """
    Build unified knowledge base from all sources.
    """
    print("\n" + "="*60)
    print("SARA SHARP KNOWLEDGE BASE BUILDER")
    print("="*60)
    print(f"Started: {datetime.now().isoformat()}")
    
    ensure_dirs()
    
    knowledge_base = {
        "metadata": {
            "subject": "Sara Sharp",
            "description": "Knowledge base for accounting firm M&A expertise",
            "created_at": datetime.now().isoformat(),
            "sources": []
        },
        "content": []
    }
    
    # YouTube transcripts
    if youtube or all_sources:
        transcripts = extract_youtube_transcripts()
        knowledge_base["content"].extend(transcripts)
        if transcripts:
            knowledge_base["metadata"]["sources"].append({
                "type": "youtube",
                "count": len(transcripts),
                "total_words": sum(t.get("word_count", 0) for t in transcripts)
            })
    
    # Blog articles
    if blog or all_sources:
        articles = extract_blog_articles()
        knowledge_base["content"].extend(articles)
        if articles:
            knowledge_base["metadata"]["sources"].append({
                "type": "blog",
                "count": len(articles),
                "total_words": sum(a.get("word_count", 0) for a in articles)
            })
    
    # Book PDF
    if book_path:
        chunks = extract_book_pdf(book_path)
        knowledge_base["content"].extend(chunks)
        if chunks:
            knowledge_base["metadata"]["sources"].append({
                "type": "book",
                "count": len(chunks),
                "total_words": sum(c.get("word_count", 0) for c in chunks)
            })
    
    # LinkedIn posts
    if linkedin_export:
        posts = extract_linkedin_posts(linkedin_export)
        knowledge_base["content"].extend(posts)
        if posts:
            knowledge_base["metadata"]["sources"].append({
                "type": "linkedin",
                "count": len(posts)
            })
    
    # Podcast episodes
    if podcast or all_sources:
        episodes = extract_podcast_episodes()
        knowledge_base["content"].extend(episodes)
        if episodes:
            knowledge_base["metadata"]["sources"].append({
                "type": "podcast",
                "count": len(episodes),
                "note": "Audio needs transcription"
            })
    
    # Deal Academy courses
    if deal_academy_creds:
        courses = extract_deal_academy(deal_academy_creds)
        knowledge_base["content"].extend(courses)
        if courses:
            knowledge_base["metadata"]["sources"].append({
                "type": "deal_academy",
                "count": len(courses)
            })
    
    # Calculate totals
    knowledge_base["metadata"]["total_items"] = len(knowledge_base["content"])
    knowledge_base["metadata"]["total_words"] = sum(
        item.get("word_count", len(item.get("content", "").split()))
        for item in knowledge_base["content"]
    )
    
    # Save outputs
    save_json(knowledge_base, "sara_knowledge_base.json")
    
    # Also create markdown version for easy reading
    markdown = generate_markdown_summary(knowledge_base)
    save_markdown(markdown, "sara_knowledge_base.md")
    
    # Create chunked version for RAG (smaller pieces)
    chunks = create_rag_chunks(knowledge_base)
    save_json({"chunks": chunks}, "sara_rag_chunks.json")
    
    print("\n" + "="*60)
    print("EXTRACTION COMPLETE")
    print("="*60)
    print(f"Total items: {knowledge_base['metadata']['total_items']}")
    print(f"Total words: {knowledge_base['metadata']['total_words']:,}")
    print(f"\nOutput files:")
    print(f"  - {CONFIG['output_dir']}/sara_knowledge_base.json")
    print(f"  - {CONFIG['output_dir']}/sara_knowledge_base.md")
    print(f"  - {CONFIG['output_dir']}/sara_rag_chunks.json")
    
    return knowledge_base


def generate_markdown_summary(kb: dict) -> str:
    """Generate a readable markdown summary of the knowledge base."""
    md = []
    md.append("# Sara Sharp Knowledge Base\n")
    md.append(f"Generated: {kb['metadata']['created_at']}\n")
    md.append(f"Total Items: {kb['metadata']['total_items']}\n")
    md.append(f"Total Words: {kb['metadata']['total_words']:,}\n")
    
    md.append("\n## Sources\n")
    for source in kb['metadata']['sources']:
        md.append(f"- **{source['type']}**: {source['count']} items")
        if 'total_words' in source:
            md.append(f" ({source['total_words']:,} words)")
        if 'note' in source:
            md.append(f" - {source['note']}")
        md.append("\n")
    
    md.append("\n## Content Index\n")
    
    # Group by source type
    by_type = {}
    for item in kb['content']:
        source_type = item.get('source_type', item.get('source', 'unknown'))
        if source_type not in by_type:
            by_type[source_type] = []
        by_type[source_type].append(item)
    
    for source_type, items in by_type.items():
        md.append(f"\n### {source_type.replace('_', ' ').title()}\n")
        for item in items[:50]:  # Limit to first 50 per type
            title = item.get('title', item.get('url', 'Untitled'))[:80]
            words = item.get('word_count', 0)
            md.append(f"- {title}")
            if words:
                md.append(f" ({words:,} words)")
            md.append("\n")
        if len(items) > 50:
            md.append(f"- ... and {len(items) - 50} more\n")
    
    return ''.join(md)


def create_rag_chunks(kb: dict, chunk_size: int = 1000, overlap: int = 200) -> list[dict]:
    """
    Create smaller chunks optimized for RAG retrieval.
    
    Args:
        kb: Knowledge base dictionary
        chunk_size: Target words per chunk
        overlap: Words of overlap between chunks
    """
    chunks = []
    
    for item in kb['content']:
        content = item.get('content', '')
        if not content:
            continue
        
        words = content.split()
        
        if len(words) <= chunk_size:
            # Small enough to use as-is
            chunks.append({
                "id": item['id'],
                "chunk_index": 0,
                "source": item.get('source'),
                "source_type": item.get('source_type'),
                "title": item.get('title'),
                "url": item.get('url'),
                "content": content,
                "word_count": len(words)
            })
        else:
            # Split into chunks
            start = 0
            chunk_idx = 0
            while start < len(words):
                end = start + chunk_size
                chunk_words = words[start:end]
                
                chunks.append({
                    "id": f"{item['id']}-{chunk_idx}",
                    "chunk_index": chunk_idx,
                    "source": item.get('source'),
                    "source_type": item.get('source_type'),
                    "title": item.get('title'),
                    "url": item.get('url'),
                    "content": ' '.join(chunk_words),
                    "word_count": len(chunk_words)
                })
                
                start = end - overlap
                chunk_idx += 1
    
    return chunks


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Extract Sara Sharp's content for knowledge base",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sara_content_extractor.py --all
  python sara_content_extractor.py --youtube --blog
  python sara_content_extractor.py --book /path/to/book.pdf
  python sara_content_extractor.py --linkedin /path/to/export.json
        """
    )
    
    parser.add_argument('--all', action='store_true',
                        help='Extract from all available sources')
    parser.add_argument('--youtube', action='store_true',
                        help='Extract YouTube transcripts')
    parser.add_argument('--blog', action='store_true',
                        help='Extract SK&S blog articles')
    parser.add_argument('--podcast', action='store_true',
                        help='Extract podcast episode metadata')
    parser.add_argument('--book', type=str, metavar='PATH',
                        help='Path to book PDF file')
    parser.add_argument('--linkedin', type=str, metavar='PATH',
                        help='Path to LinkedIn export file (JSON or CSV)')
    parser.add_argument('--deal-academy', action='store_true',
                        help='Extract Deal Academy courses (requires credentials)')
    parser.add_argument('--email', type=str,
                        help='Email for Deal Academy login')
    parser.add_argument('--password', type=str,
                        help='Password for Deal Academy login')
    parser.add_argument('--output-dir', type=str,
                        help='Output directory for extracted content')
    
    args = parser.parse_args()
    
    if args.output_dir:
        CONFIG['output_dir'] = args.output_dir
    
    # Check if any source selected
    if not any([args.all, args.youtube, args.blog, args.podcast,
                args.book, args.linkedin, args.deal_academy]):
        parser.print_help()
        print("\nNo source selected. Use --all or specify individual sources.")
        return
    
    # Build credentials dict if provided
    deal_academy_creds = None
    if args.deal_academy and args.email and args.password:
        deal_academy_creds = {
            'email': args.email,
            'password': args.password
        }
    
    # Run extraction
    build_knowledge_base(
        youtube=args.youtube,
        blog=args.blog,
        book_path=args.book,
        linkedin_export=args.linkedin,
        podcast=args.podcast,
        deal_academy_creds=deal_academy_creds,
        all_sources=args.all
    )


if __name__ == "__main__":
    main()
