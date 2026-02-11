#!/usr/bin/env python3
"""
GHL -> Baserow Contact Sync Script.

Fetches contacts from GoHighLevel and syncs them to Baserow,
handling deduplication, rate limiting, and error recovery.

Usage:
    python scripts/sync_contacts.py           # Run full sync
    python scripts/sync_contacts.py --dry-run # Preview changes without writing

Author: Someday Consultants
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.utils import (
    CircuitBreaker,
    CircuitOpenError,
    ContactDeduplicator,
    RateLimiter,
    RetryWithBackoff,
    SyncLogger,
    SyncState,
    fetch_baserow_contacts,
)


# =============================================================================
# Configuration
# =============================================================================

# Baserow table and field IDs
CONTACTS_TABLE_ID = 817355
FIELD_GHL_CONTACT_ID = 7014113
FIELD_CONTACT_TYPE = 7012622
FIELD_STATUS = 7012623
FIELD_SOURCE = 7012624

# Contact Type mapping (GHL tag -> Baserow select option ID)
CONTACT_TYPE_MAP: dict[str, int] = {
    "buyer": 5147198,
    "seller": 5147199,
    "both": 5147200,
    "advisor": 5147201,
    "other": 5147202,
}

# Status mapping
STATUS_MAP: dict[str, int] = {
    "active": 5147203,
    "inactive": 5147204,
    "do not contact": 5147205,
    "dnc": 5147205,
}

# Source mapping (GHL tag -> Baserow select option ID)
SOURCE_MAP: dict[str, int] = {
    "website": 5147206,
    "referral": 5147207,
    "linkedin": 5147208,
    "conference": 5147209,
    "cold outreach": 5147210,
    "cold": 5147210,
    "outreach": 5147210,
    "other": 5147211,
    "deal academy": 5148110,
    "dealacademy": 5148110,
    "deal_academy": 5148110,
}

# GHL API configuration
GHL_BASE_URL = "https://services.leadconnectorhq.com"
GHL_API_VERSION = "2021-07-28"

# Baserow API configuration
BASEROW_BASE_URL = "https://api.baserow.io"


# =============================================================================
# GHL API Functions
# =============================================================================


def fetch_ghl_contacts(
    api_token: str,
    location_id: str,
    rate_limiter: RateLimiter,
    circuit_breaker: CircuitBreaker,
    retry_handler: RetryWithBackoff,
    logger: SyncLogger,
) -> list[dict[str, Any]]:
    """
    Fetch all contacts from GHL API with pagination.

    Args:
        api_token: GHL API bearer token
        location_id: GHL location ID
        rate_limiter: Rate limiter instance
        circuit_breaker: Circuit breaker instance
        retry_handler: Retry handler instance
        logger: Sync logger instance

    Returns:
        List of contact dictionaries from GHL
    """
    contacts: list[dict[str, Any]] = []
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Version": GHL_API_VERSION,
        "Content-Type": "application/json",
    }

    # Initial URL with location filter
    url: Optional[str] = f"{GHL_BASE_URL}/contacts/"
    params: dict[str, Any] = {
        "locationId": location_id,
        "limit": 100,
    }

    page = 1
    while url:
        logger.debug(f"Fetching GHL contacts page {page}...")
        rate_limiter.wait()

        def make_request() -> requests.Response:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            return response

        try:
            response = circuit_breaker.call(
                retry_handler.execute,
                make_request,
                retryable_exceptions=(requests.RequestException,),
            )
            data = response.json()

            page_contacts = data.get("contacts", [])
            contacts.extend(page_contacts)
            logger.debug(f"Page {page}: Retrieved {len(page_contacts)} contacts")

            # Handle pagination - GHL uses cursor-based pagination
            meta = data.get("meta", {})
            next_page_url = meta.get("nextPageUrl")

            if next_page_url:
                url = next_page_url
                params = {}  # URL already contains params
            else:
                url = None

            page += 1

        except CircuitOpenError as e:
            logger.error(f"Circuit breaker open: {e}")
            break
        except requests.RequestException as e:
            logger.error(f"Failed to fetch GHL contacts: {e}")
            break

    logger.info(f"Fetched {len(contacts)} total contacts from GHL")
    return contacts


# =============================================================================
# Tag Mapping Functions
# =============================================================================


def extract_contact_type(tags: list[str]) -> Optional[int]:
    """
    Extract contact type from GHL tags.

    Args:
        tags: List of GHL tag strings

    Returns:
        Baserow select option ID or None if no match
    """
    normalized_tags = [t.lower().strip() for t in tags]

    # Check for specific types
    has_buyer = any("buyer" in t for t in normalized_tags)
    has_seller = any("seller" in t for t in normalized_tags)

    if has_buyer and has_seller:
        return CONTACT_TYPE_MAP["both"]
    if has_buyer:
        return CONTACT_TYPE_MAP["buyer"]
    if has_seller:
        return CONTACT_TYPE_MAP["seller"]

    # Check other types
    for tag in normalized_tags:
        if "advisor" in tag:
            return CONTACT_TYPE_MAP["advisor"]

    return None  # Will default to "Other" or be left empty


def extract_source(tags: list[str]) -> Optional[int]:
    """
    Extract source from GHL tags.

    Args:
        tags: List of GHL tag strings

    Returns:
        Baserow select option ID or None if no match
    """
    normalized_tags = [t.lower().strip() for t in tags]

    for tag in normalized_tags:
        for source_key, source_id in SOURCE_MAP.items():
            if source_key in tag:
                return source_id

    return None


def extract_status(tags: list[str]) -> Optional[int]:
    """
    Extract status from GHL tags.

    Args:
        tags: List of GHL tag strings

    Returns:
        Baserow select option ID or None if no match
    """
    normalized_tags = [t.lower().strip() for t in tags]

    for tag in normalized_tags:
        for status_key, status_id in STATUS_MAP.items():
            if status_key in tag:
                return status_id

    # Default to Active if no explicit status
    return STATUS_MAP["active"]


# =============================================================================
# Baserow API Functions
# =============================================================================


def transform_ghl_to_baserow(ghl_contact: dict[str, Any]) -> dict[str, Any]:
    """
    Transform a GHL contact to Baserow row format.

    Args:
        ghl_contact: Contact data from GHL API

    Returns:
        Dictionary formatted for Baserow row creation/update
    """
    tags = ghl_contact.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]

    # Build Baserow row data
    row_data: dict[str, Any] = {
        # Store GHL contact ID using field ID
        f"field_{FIELD_GHL_CONTACT_ID}": ghl_contact.get("id", ""),
        # Standard fields by name (Baserow accepts field names or IDs)
        "Name": f"{ghl_contact.get('firstName', '')} {ghl_contact.get('lastName', '')}".strip(),
        "Email": ghl_contact.get("email", ""),
        "Phone": ghl_contact.get("phone", ""),
        "Company": ghl_contact.get("companyName", ""),
    }

    # Map tags to select fields (using field IDs for select options)
    contact_type = extract_contact_type(tags)
    if contact_type:
        row_data[f"field_{FIELD_CONTACT_TYPE}"] = contact_type

    source = extract_source(tags)
    if source:
        row_data[f"field_{FIELD_SOURCE}"] = source

    status = extract_status(tags)
    if status:
        row_data[f"field_{FIELD_STATUS}"] = status

    # Handle address if present
    address_parts = []
    if ghl_contact.get("address1"):
        address_parts.append(ghl_contact["address1"])
    if ghl_contact.get("city"):
        address_parts.append(ghl_contact["city"])
    if ghl_contact.get("state"):
        address_parts.append(ghl_contact["state"])
    if ghl_contact.get("postalCode"):
        address_parts.append(ghl_contact["postalCode"])

    if address_parts:
        row_data["Address"] = ", ".join(address_parts)

    # Notes from custom fields or GHL notes
    custom_values = ghl_contact.get("customFields", [])
    notes_parts = []
    for cv in custom_values:
        if cv.get("value"):
            notes_parts.append(f"{cv.get('key', 'Note')}: {cv['value']}")
    if notes_parts:
        row_data["Notes"] = "\n".join(notes_parts)

    return row_data


def create_baserow_row(
    api_token: str,
    table_id: int,
    row_data: dict[str, Any],
    rate_limiter: RateLimiter,
    circuit_breaker: CircuitBreaker,
    retry_handler: RetryWithBackoff,
) -> dict[str, Any]:
    """
    Create a new row in Baserow.

    Args:
        api_token: Baserow API token
        table_id: Target table ID
        row_data: Row data dictionary
        rate_limiter: Rate limiter instance
        circuit_breaker: Circuit breaker instance
        retry_handler: Retry handler instance

    Returns:
        Created row data from Baserow
    """
    rate_limiter.wait()

    url = f"{BASEROW_BASE_URL}/api/database/rows/table/{table_id}/"
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
    }

    def make_request() -> requests.Response:
        response = requests.post(url, headers=headers, json=row_data, timeout=30)
        response.raise_for_status()
        return response

    response = circuit_breaker.call(
        retry_handler.execute,
        make_request,
        retryable_exceptions=(requests.RequestException,),
    )
    return response.json()


def update_baserow_row(
    api_token: str,
    table_id: int,
    row_id: int,
    row_data: dict[str, Any],
    rate_limiter: RateLimiter,
    circuit_breaker: CircuitBreaker,
    retry_handler: RetryWithBackoff,
) -> dict[str, Any]:
    """
    Update an existing row in Baserow.

    Args:
        api_token: Baserow API token
        table_id: Target table ID
        row_id: Row ID to update
        row_data: Row data dictionary
        rate_limiter: Rate limiter instance
        circuit_breaker: Circuit breaker instance
        retry_handler: Retry handler instance

    Returns:
        Updated row data from Baserow
    """
    rate_limiter.wait()

    url = f"{BASEROW_BASE_URL}/api/database/rows/table/{table_id}/{row_id}/"
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
    }

    def make_request() -> requests.Response:
        response = requests.patch(url, headers=headers, json=row_data, timeout=30)
        response.raise_for_status()
        return response

    response = circuit_breaker.call(
        retry_handler.execute,
        make_request,
        retryable_exceptions=(requests.RequestException,),
    )
    return response.json()


# =============================================================================
# Main Sync Logic
# =============================================================================


def sync_contacts(dry_run: bool = False) -> dict[str, Any]:
    """
    Main sync function - fetches GHL contacts and syncs to Baserow.

    Args:
        dry_run: If True, only preview changes without writing

    Returns:
        Sync statistics dictionary
    """
    # Load environment variables
    load_dotenv()

    baserow_token = os.environ.get("BASEROW_API_TOKEN")
    ghl_token = os.environ.get("GHL_API_TOKEN")
    ghl_location_id = os.environ.get("GHL_LOCATION_ID")

    if not all([baserow_token, ghl_token, ghl_location_id]):
        raise ValueError(
            "Missing required environment variables: "
            "BASEROW_API_TOKEN, GHL_API_TOKEN, GHL_LOCATION_ID"
        )

    # Initialize utilities
    logger = SyncLogger("contacts")
    state = SyncState()
    rate_limiter = RateLimiter(requests_per_minute=60)
    circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
    retry_handler = RetryWithBackoff(max_retries=3, base_delay=1.0, max_delay=30.0)

    logger.start_sync(f"dry_run={dry_run}")

    try:
        # Step 1: Fetch existing Baserow contacts for deduplication
        logger.info("Loading existing Baserow contacts for deduplication...")
        existing_contacts = fetch_baserow_contacts(baserow_token, CONTACTS_TABLE_ID)
        logger.info(f"Loaded {len(existing_contacts)} existing contacts from Baserow")

        # Initialize deduplicator with existing contacts
        deduplicator = ContactDeduplicator(existing_contacts)

        # Step 2: Fetch GHL contacts
        logger.info("Fetching contacts from GHL...")
        ghl_contacts = fetch_ghl_contacts(
            ghl_token,
            ghl_location_id,
            rate_limiter,
            circuit_breaker,
            retry_handler,
            logger,
        )

        if not ghl_contacts:
            logger.warning("No contacts found in GHL")
            return logger.end_sync(success=True)

        # Step 3: Process each contact
        total = len(ghl_contacts)
        logger.info(f"Processing {total} GHL contacts...")

        for i, ghl_contact in enumerate(ghl_contacts, 1):
            ghl_id = ghl_contact.get("id", "unknown")
            email = ghl_contact.get("email", "")
            name = f"{ghl_contact.get('firstName', '')} {ghl_contact.get('lastName', '')}".strip()
            identifier = f"{name} ({email or ghl_id})"

            try:
                # Determine action: create or update
                action, existing = deduplicator.get_action(ghl_contact)

                # Transform GHL contact to Baserow format
                row_data = transform_ghl_to_baserow(ghl_contact)

                if action == "create":
                    if dry_run:
                        logger.record_create(identifier, "DRY RUN - would create")
                        logger.debug(f"  Would create with data: {row_data}")
                    else:
                        result = create_baserow_row(
                            baserow_token,
                            CONTACTS_TABLE_ID,
                            row_data,
                            rate_limiter,
                            circuit_breaker,
                            retry_handler,
                        )
                        # Add to deduplicator index
                        deduplicator.add_to_index(
                            ghl_id,
                            email,
                            ghl_contact.get("phone", ""),
                            result,
                        )
                        logger.record_create(
                            identifier, f"Baserow ID: {result.get('id')}"
                        )
                        state.increment_synced("contacts")

                elif action == "update":
                    existing_id = existing.get("id") if existing else None
                    if dry_run:
                        logger.record_update(
                            identifier, f"DRY RUN - would update Baserow ID: {existing_id}"
                        )
                        logger.debug(f"  Would update with data: {row_data}")
                    else:
                        if existing_id:
                            update_baserow_row(
                                baserow_token,
                                CONTACTS_TABLE_ID,
                                existing_id,
                                row_data,
                                rate_limiter,
                                circuit_breaker,
                                retry_handler,
                            )
                            logger.record_update(
                                identifier, f"Baserow ID: {existing_id}"
                            )
                            state.increment_synced("contacts")
                        else:
                            logger.record_error(
                                identifier,
                                "Found duplicate but no Baserow ID for update",
                            )

                # Log progress every 25 contacts
                if i % 25 == 0 or i == total:
                    logger.log_progress(i, total)

            except CircuitOpenError as e:
                logger.record_error(identifier, f"Circuit breaker open: {e}")
                state.record_error("contacts", str(e), {"ghl_id": ghl_id})
                break  # Stop processing when circuit is open

            except requests.RequestException as e:
                logger.record_error(identifier, f"API error: {e}")
                state.record_error("contacts", str(e), {"ghl_id": ghl_id})
                continue  # Try next contact

            except Exception as e:
                logger.record_error(identifier, f"Unexpected error: {e}")
                state.record_error("contacts", str(e), {"ghl_id": ghl_id})
                continue

        # Update sync state
        if not dry_run:
            state.set_last_sync("contacts")
            state.clear_error("contacts")

        stats = logger.end_sync(success=True)
        return stats

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        state.record_error("contacts", str(e))
        return logger.end_sync(success=False)


# =============================================================================
# CLI Entry Point
# =============================================================================


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Sync contacts from GHL to Baserow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/sync_contacts.py              # Run full sync
  python scripts/sync_contacts.py --dry-run    # Preview changes
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to Baserow",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose debug output",
    )

    args = parser.parse_args()

    # Set logging level based on verbosity
    if args.verbose:
        import logging

        logging.getLogger().setLevel(logging.DEBUG)

    try:
        stats = sync_contacts(dry_run=args.dry_run)

        if stats.get("success"):
            print("\nSync completed successfully!")
            print(f"  Created: {stats.get('created', 0)}")
            print(f"  Updated: {stats.get('updated', 0)}")
            print(f"  Skipped: {stats.get('skipped', 0)}")
            print(f"  Errors:  {stats.get('errors', 0)}")
            if stats.get("duration_seconds"):
                print(f"  Duration: {stats['duration_seconds']:.1f}s")
            return 0
        else:
            print("\nSync failed. Check logs for details.")
            return 1

    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        return 2

    except KeyboardInterrupt:
        print("\nSync interrupted by user.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
