#!/usr/bin/env python3
"""
Denver Restaurant Week 2026 Scraper

Fetches restaurant and menu data from the DRW custom API
and builds a consolidated JSON database for the frontend.
"""

import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

API_BASE = "https://denverrestaurantweek.com/wp-json/explore-menus"
OUTPUT_FILE = Path(__file__).parent.parent / "src" / "data" / "restaurants.json"

HEADERS = {
    "User-Agent": "DRW-Scraper/1.0 (Denver Restaurant Week Explorer)",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

RATE_LIMIT = 1.0


class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip = True
        if tag == "br":
            self.result.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = False
        if tag in ("p", "div", "li", "h1", "h2", "h3", "h4"):
            self.result.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.result.append(data)


def strip_html(html_str: str) -> str:
    if not html_str:
        return ""
    stripper = HTMLStripper()
    stripper.feed(html_str)
    text = "".join(stripper.result)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def api_post(url: str, body: dict, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            data = json.dumps(body).encode("utf-8")
            req = Request(url, data=data, headers=HEADERS, method="POST")
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as e:
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Retry {attempt + 1}/{retries}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                raise


def api_get(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            req = Request(url, headers={
                "User-Agent": HEADERS["User-Agent"],
                "Accept": "application/json",
            })
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as e:
            if attempt < retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Retry {attempt + 1}/{retries}: {e} (waiting {wait}s)")
                time.sleep(wait)
            else:
                raise


def parse_course_description(html: str) -> dict:
    """Parse a course_description HTML string into course name and items."""
    text = strip_html(html)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    if not lines:
        return {"name": "Course", "items": []}

    course_name = lines[0]
    items = []
    current_item = None

    for line in lines[1:]:
        if line.startswith("\u2013") or (line.startswith("-") and len(line) < 10):
            continue

        is_name = (
            len(line) < 80
            and not line[0].islower()
            and not line.startswith("(")
            and "." not in line[:20]
        )

        if is_name and (current_item is None or current_item.get("description")):
            current_item = {"name": line, "description": ""}
            items.append(current_item)
        elif current_item is not None:
            if current_item["description"]:
                current_item["description"] += " " + line
            else:
                current_item["description"] = line

    return {"name": course_name, "items": items}


def format_address(addr: dict) -> str:
    if not addr:
        return ""
    parts = []
    if addr.get("address"):
        parts.append(addr["address"].rstrip(",").strip())
    if addr.get("address_2"):
        parts.append(addr["address_2"].rstrip(",").strip())
    city_state_zip = []
    if addr.get("city"):
        city_state_zip.append(addr["city"].title())
    if addr.get("state"):
        state = addr["state"].upper() if len(addr["state"]) == 2 else addr["state"].title()
        city_state_zip.append(state)
    if addr.get("zipcode"):
        city_state_zip.append(addr["zipcode"])
    if city_state_zip:
        parts.append(", ".join(city_state_zip[:2]) + (" " + city_state_zip[2] if len(city_state_zip) > 2 else ""))
    return ", ".join(parts)


def main():
    print("=" * 60)
    print("Denver Restaurant Week 2026 Scraper")
    print("=" * 60)

    # Fetch setup data for reference
    print("\nFetching setup data...")
    api_get(f"{API_BASE}/setup")
    print("  Setup loaded")

    # Fetch all restaurants via paginated query
    print("\nFetching restaurants...")
    all_restaurants = []
    page = 1
    total_pages = None

    while True:
        print(f"  Page {page}{'/' + str(total_pages) if total_pages else ''}...")
        resp = api_post(f"{API_BASE}/query", {"page": page})
        data = resp.get("data", resp)

        results = data.get("results", [])
        found_posts = data.get("found_posts", 0)
        max_pages = data.get("max_num_pages", 1)

        if total_pages is None:
            total_pages = max_pages
            print(f"  Found {found_posts} restaurants across {max_pages} pages")

        if not results:
            break

        all_restaurants.extend(results)
        print(f"    Got {len(results)} restaurants (total so far: {len(all_restaurants)})")

        if page >= max_pages:
            break
        page += 1
        time.sleep(RATE_LIMIT)

    print(f"\n  Total fetched: {len(all_restaurants)} restaurants")

    # Process into clean format
    print("\nProcessing restaurant data...")
    restaurants = []

    for raw in all_restaurants:
        addr = raw.get("restaurant_address", {}) or {}
        address_str = format_address(addr)
        lat = addr.get("lat", "")
        lng = addr.get("lng", "")

        menu_data = raw.get("menu", {}) or {}
        menu_items = menu_data.get("restaurant_menu", []) or []
        courses = []
        for item in menu_items:
            desc = item.get("course_description", "")
            if desc:
                course = parse_course_description(desc)
                if course["items"]:
                    courses.append(course)

        price_point = (
            raw.get("menu_pricepoint", "")
            or raw.get("restaurant_menu_pricepoint", "")
            or menu_data.get("restaurant_menu_pricepoint", "")
            or ""
        )

        image = raw.get("featured_image", "")
        gallery = raw.get("restaurant_gallery", []) or []
        if not image and gallery:
            first = gallery[0]
            if isinstance(first, dict):
                sizes = first.get("sizes", {})
                image = (
                    sizes.get("medium_large", "")
                    or sizes.get("medium", "")
                    or first.get("url", "")
                )

        hours_raw = raw.get("restaurant_hours", {}) or {}
        hours_notes = strip_html(raw.get("restaurant_notes_hours", ""))
        hours = {}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
            if hours_raw.get(day):
                hours[day] = {
                    "open": True,
                    "from": hours_raw.get(f"{day}_from", ""),
                    "to": hours_raw.get(f"{day}_to", ""),
                }
            else:
                hours[day] = {"open": False, "from": "", "to": ""}

        url = raw.get("url", "")
        slug = url.rstrip("/").split("/")[-1] if url else str(raw.get("ID", ""))

        restaurant = {
            "id": raw.get("ID", 0),
            "name": raw.get("title", ""),
            "slug": slug,
            "url": url,
            "address": address_str,
            "lat": lat,
            "lng": lng,
            "phone": raw.get("restaurant_phone", ""),
            "website": raw.get("restaurant_website", ""),
            "email": raw.get("restaurant_email", ""),
            "instagram": raw.get("restaurant_instagram", ""),
            "facebook": raw.get("restaurant_facebook", ""),
            "image": image,
            "cuisines": raw.get("restaurant_cuisine", []) or [],
            "cuisine_primary": raw.get("restaurant_cuisine_primary", ""),
            "neighborhoods": raw.get("restaurant_neighborhood", []) or [],
            "amenities": raw.get("restaurant_amenities", []) or [],
            "features": raw.get("restaurant_feature", []) or [],
            "dietary": raw.get("restaurant_dietary_restriction", []) or [],
            "price_point": str(price_point) if price_point else "",
            "has_menu": bool(raw.get("has_menu")),
            "menu_status": raw.get("menu_status", ""),
            "courses": courses,
            "hours": hours,
            "hours_notes": hours_notes,
            "google_maps_url": raw.get("google_maps_url", ""),
            "open_table_id": raw.get("restaurant_open_table_id", ""),
        }
        restaurants.append(restaurant)

    restaurants.sort(key=lambda r: r["name"].lower())

    with_menus = sum(1 for r in restaurants if r["courses"])
    cuisine_set = set()
    for r in restaurants:
        cuisine_set.update(r["cuisines"])
    neighborhood_set = set()
    for r in restaurants:
        neighborhood_set.update(r["neighborhoods"])

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(restaurants, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Done! Wrote {len(restaurants)} restaurants to {OUTPUT_FILE}")
    print(f"  With menu courses: {with_menus}")
    print(f"  Unique cuisines: {len(cuisine_set)}")
    print(f"  Unique neighborhoods: {len(neighborhood_set)}")
    print(f"  Price points: {sorted(set(r['price_point'] for r in restaurants if r['price_point']))}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
