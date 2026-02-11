#!/usr/bin/env python3
"""
GHL Opportunities -> Baserow Deals Sync Script.

Syncs opportunities from GHL Buyer and Seller pipelines to Baserow Deals table.
Uses deduplication, rate limiting, circuit breaker, and comprehensive logging.

Usage:
    python scripts/sync_opportunities.py           # Full sync
    python scripts/sync_opportunities.py --dry-run # Preview changes only

Environment Variables (from .env):
    BASEROW_API_TOKEN: Baserow API token
    GHL_API_TOKEN: GHL API token
    GHL_LOCATION_ID: GHL location ID

Author: Someday Consultants
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.utils.deduplication import (
    ContactDeduplicator,
    OpportunityDeduplicator,
    fetch_baserow_contacts,
    fetch_baserow_deals,
)
from scripts.utils.logging_config import SyncLogger
from scripts.utils.rate_limiter import CircuitBreaker, CircuitOpenError, RateLimiter, RetryWithBackoff
from scripts.utils.sync_state import SyncState


# =============================================================================
# Configuration
# =============================================================================

# GHL API Configuration
GHL_BASE_URL = "https://services.leadconnectorhq.com"
GHL_API_VERSION = "2021-07-28"

# Pipeline IDs to sync
PIPELINES = {
    "buyer": "bZP2ihvK0wk0NaERm2TA",
    "seller": "u0xJpO4msaNpBqvd1anz",
}

# Baserow Configuration
BASEROW_BASE_URL = "https://api.baserow.io"
DEALS_TABLE_ID = 817373
CONTACTS_TABLE_ID = 817355
BUYER_PROFILES_TABLE_ID = 817366

# Field IDs
FIELD_IDS = {
    # Deals table fields
    "deal_name": 7012683,
    "deal_notes": 7012684,
    "deal_active": 7012685,
    "deal_buyer": 7012687,  # link_row to Buyer Profiles
    "deal_stage": 7012691,
    "deal_value": 7012692,
    "deal_expected_close": 7012693,
    "deal_actual_close": 7012694,
    "deal_commission": 7012695,
    "deal_notes_field": 7012696,
    "deal_loss_reason": 7012697,
    "ghl_opportunity_id": 7014114,
    # Contacts table fields
    "ghl_contact_id": 7014113,
}

# GHL Stage ID -> Baserow Deal Stage mapping
BUYER_STAGE_MAP = {
    "e5b69b66-705e-49e7-a0bf-e2b7a86197a5": "Initial Interest",  # Lead
    "a8910d32-4bc2-45ad-9c90-b5186aae2c0c": "Initial Interest",  # Engaged Buyer
    "742e5ebb-2113-4792-a2eb-41aa7c2e56b7": "NDA Signed",  # Seller Outreach & NDA
    "07ec4c25-895a-402c-9e75-cfbbc16f53c5": "LOI Submitted",  # LOI Submitted
    "4484b292-7faa-4761-a9b2-ad59fd887cc7": "Due Diligence",  # Due Diligence
    "a73baee5-9f40-44c6-a898-f5a9aa1d3d49": "Under Contract",  # Financing
    "3a74ecfc-082e-49f5-a226-582ed5f8cbe4": "Under Contract",  # Closing
}

SELLER_STAGE_MAP = {
    "e5ab1bad-c614-483b-9358-8fdcce1d0efc": "Initial Interest",  # Lead
    "6e65fd88-18e3-4b32-84fe-306e23709b93": "Initial Interest",  # Engaged Seller
    "52256d41-5453-4862-8374-70eaad2eb93e": "NDA Signed",  # Buyer Outreach & NDA
    "6f12394d-3abc-4291-9d8f-99e2d1ae57f7": "LOI Submitted",  # LOI Stage
    "1a276b5a-cf00-45e8-b61f-4a8904a14350": "Due Diligence",  # Collecting DD
    "b3fa299f-5bd0-477d-966f-9609f4b8a2e8": "Under Contract",  # Deal Finalization
    "209f67f6-6802-497f-b0cc-476a1812da6c": "Under Contract",  # Closing
}

# Rate limiting configuration
GHL_REQUESTS_PER_MINUTE = 60
BASEROW_REQUESTS_PER_MINUTE = 120


# =============================================================================
# GHL API Client
# =============================================================================

class GHLClient:
    """GHL API client with rate limiting and error handling."""

    def __init__(
        self,
        api_token: str,
        location_id: str,
        rate_limiter: RateLimiter,
        circuit_breaker: CircuitBreaker,
        retry: RetryWithBackoff,
        logger: SyncLogger,
    ):
        self.api_token = api_token
        self.location_id = location_id
        self.rate_limiter = rate_limiter
        self.circuit_breaker = circuit_breaker
        self.retry = retry
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Version": GHL_API_VERSION,
            "Content-Type": "application/json",
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> dict[str, Any]:
        """Make rate-limited, circuit-broken API request."""
        self.rate_limiter.wait()

        url = f"{GHL_BASE_URL}{endpoint}"

        def do_request():
            response = self.session.request(method, url, timeout=30, **kwargs)
            response.raise_for_status()
            return response.json()

        return self.circuit_breaker.call(
            lambda: self.retry.execute(
                do_request,
                retryable_exceptions=(requests.RequestException,),
            )
        )

    def get_opportunities(self, pipeline_id: str) -> list[dict[str, Any]]:
        """
        Fetch all opportunities from a pipeline.

        Args:
            pipeline_id: GHL pipeline ID

        Returns:
            List of opportunity dictionaries
        """
        all_opportunities: list[dict[str, Any]] = []
        page = 1
        limit = 100  # GHL default page size

        self.logger.info(f"Fetching opportunities from pipeline {pipeline_id}")

        while True:
            try:
                endpoint = (
                    f"/opportunities/search"
                    f"?location_id={self.location_id}"
                    f"&pipeline_id={pipeline_id}"
                    f"&limit={limit}"
                    f"&page={page}"
                )

                data = self._request("GET", endpoint)
                opportunities = data.get("opportunities", [])

                if not opportunities:
                    break

                all_opportunities.extend(opportunities)
                self.logger.debug(f"Fetched page {page}: {len(opportunities)} opportunities")

                # Check if more pages exist
                meta = data.get("meta", {})
                total = meta.get("total", len(all_opportunities))
                if len(all_opportunities) >= total:
                    break

                page += 1

            except CircuitOpenError as e:
                self.logger.error(f"Circuit breaker open: {e}")
                raise
            except Exception as e:
                self.logger.error(f"Failed to fetch opportunities page {page}: {e}")
                raise

        self.logger.info(f"Fetched {len(all_opportunities)} opportunities from pipeline")
        return all_opportunities


# =============================================================================
# Baserow API Client
# =============================================================================

class BaserowClient:
    """Baserow API client with rate limiting and error handling."""

    def __init__(
        self,
        api_token: str,
        rate_limiter: RateLimiter,
        circuit_breaker: CircuitBreaker,
        retry: RetryWithBackoff,
        logger: SyncLogger,
    ):
        self.api_token = api_token
        self.rate_limiter = rate_limiter
        self.circuit_breaker = circuit_breaker
        self.retry = retry
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {api_token}",
            "Content-Type": "application/json",
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> dict[str, Any]:
        """Make rate-limited, circuit-broken API request."""
        self.rate_limiter.wait()

        url = f"{BASEROW_BASE_URL}{endpoint}"

        def do_request():
            response = self.session.request(method, url, timeout=30, **kwargs)
            if not response.ok:
                # Log the actual error response for debugging
                try:
                    error_detail = response.json()
                    self.logger.error(f"API Error: {response.status_code} - {error_detail}")
                except Exception:
                    self.logger.error(f"API Error: {response.status_code} - {response.text[:500]}")
            response.raise_for_status()
            return response.json() if response.content else {}

        return self.circuit_breaker.call(
            lambda: self.retry.execute(
                do_request,
                retryable_exceptions=(requests.RequestException,),
            )
        )

    def create_deal(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a deal in Baserow."""
        endpoint = f"/api/database/rows/table/{DEALS_TABLE_ID}/"
        return self._request("POST", endpoint, json=data)

    def update_deal(self, row_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Update a deal in Baserow."""
        endpoint = f"/api/database/rows/table/{DEALS_TABLE_ID}/{row_id}/"
        return self._request("PATCH", endpoint, json=data)

    def find_contact_by_ghl_id(self, ghl_contact_id: str) -> Optional[dict[str, Any]]:
        """Find a contact by GHL contact ID."""
        endpoint = (
            f"/api/database/rows/table/{CONTACTS_TABLE_ID}/"
            f"?filter__field_{FIELD_IDS['ghl_contact_id']}__equal={ghl_contact_id}"
        )
        try:
            data = self._request("GET", endpoint)
            results = data.get("results", [])
            return results[0] if results else None
        except Exception as e:
            self.logger.warning(f"Failed to find contact by GHL ID {ghl_contact_id}: {e}")
            return None

    def find_buyer_profile_by_contact(self, contact_id: int) -> Optional[dict[str, Any]]:
        """Find a buyer profile linked to a contact."""
        endpoint = (
            f"/api/database/rows/table/{BUYER_PROFILES_TABLE_ID}/"
            f"?filter__field_7012631__link_row_has={contact_id}"
        )
        try:
            data = self._request("GET", endpoint)
            results = data.get("results", [])
            return results[0] if results else None
        except Exception as e:
            self.logger.warning(f"Failed to find buyer profile for contact {contact_id}: {e}")
            return None


# =============================================================================
# Sync Logic
# =============================================================================

def get_deal_stage(pipeline_id: str, stage_id: str, status: str) -> str:
    """
    Map GHL pipeline stage to Baserow Deal Stage.

    Args:
        pipeline_id: GHL pipeline ID
        stage_id: GHL stage ID
        status: GHL opportunity status (open, won, lost, abandoned)

    Returns:
        Baserow Deal Stage value
    """
    # Handle closed statuses first
    if status == "won":
        return "Closed Won"
    if status in ("lost", "abandoned"):
        return "Closed Lost"

    # Map by pipeline
    if pipeline_id == PIPELINES["buyer"]:
        return BUYER_STAGE_MAP.get(stage_id, "Initial Interest")
    if pipeline_id == PIPELINES["seller"]:
        return SELLER_STAGE_MAP.get(stage_id, "Initial Interest")

    return "Initial Interest"


def get_deal_value(opportunity: dict[str, Any]) -> Optional[int]:
    """
    Extract deal value from opportunity.

    Checks both monetaryValue and Business Value custom field.
    Returns as integer since Baserow Deal Value field has 0 decimal places.

    Args:
        opportunity: GHL opportunity data

    Returns:
        Deal value as integer, or None if not set
    """
    # First try monetaryValue
    monetary_value = opportunity.get("monetaryValue")
    if monetary_value:
        try:
            return int(float(monetary_value))
        except (ValueError, TypeError):
            pass

    # Try Business Value custom field (zbKMzgAweiTGuEMiQMQS)
    custom_fields = opportunity.get("customFields", [])
    if isinstance(custom_fields, list):
        for cf in custom_fields:
            if cf.get("id") == "zbKMzgAweiTGuEMiQMQS":
                value = cf.get("fieldValueNumber") or cf.get("value")
                if value:
                    try:
                        return int(float(value))
                    except (ValueError, TypeError):
                        pass

    return None


def transform_opportunity_to_deal(
    opportunity: dict[str, Any],
    pipeline_id: str,
    buyer_profile_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Transform GHL opportunity to Baserow deal format.

    Args:
        opportunity: GHL opportunity data
        pipeline_id: GHL pipeline ID for stage mapping
        buyer_profile_id: Optional Baserow Buyer Profile ID to link

    Returns:
        Dictionary with Baserow field IDs as keys
    """
    stage = get_deal_stage(
        pipeline_id,
        opportunity.get("pipelineStageId", ""),
        opportunity.get("status", "open"),
    )

    deal_value = get_deal_value(opportunity)

    # Build the deal data
    data: dict[str, Any] = {
        f"field_{FIELD_IDS['deal_name']}": opportunity.get("name", "Unnamed Deal"),
        f"field_{FIELD_IDS['deal_stage']}": stage,
        f"field_{FIELD_IDS['deal_active']}": opportunity.get("status") == "open",
        f"field_{FIELD_IDS['ghl_opportunity_id']}": opportunity.get("id", ""),
    }

    # Add deal value if present
    if deal_value is not None:
        data[f"field_{FIELD_IDS['deal_value']}"] = deal_value

    # Link to buyer profile if available
    if buyer_profile_id:
        data[f"field_{FIELD_IDS['deal_buyer']}"] = [buyer_profile_id]

    # Add notes from opportunity
    notes = opportunity.get("notes") or opportunity.get("description", "")
    if notes:
        data[f"field_{FIELD_IDS['deal_notes_field']}"] = notes

    return data


def sync_opportunities(
    ghl_client: GHLClient,
    baserow_client: BaserowClient,
    contact_dedup: ContactDeduplicator,
    deal_dedup: OpportunityDeduplicator,
    sync_state: SyncState,
    logger: SyncLogger,
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Sync all opportunities from GHL to Baserow.

    Args:
        ghl_client: GHL API client
        baserow_client: Baserow API client
        contact_dedup: Contact deduplicator with indexed Baserow contacts
        deal_dedup: Deal deduplicator with indexed Baserow deals
        sync_state: State manager for tracking sync progress
        logger: Sync logger
        dry_run: If True, log actions without making changes

    Returns:
        Sync statistics dictionary
    """
    logger.start_sync(f"{'DRY RUN - ' if dry_run else ''}Syncing opportunities from GHL to Baserow")

    all_opportunities: list[tuple[dict[str, Any], str]] = []

    # Fetch opportunities from both pipelines
    for pipeline_name, pipeline_id in PIPELINES.items():
        try:
            opportunities = ghl_client.get_opportunities(pipeline_id)
            for opp in opportunities:
                all_opportunities.append((opp, pipeline_id))
            logger.info(f"Fetched {len(opportunities)} opportunities from {pipeline_name} pipeline")
        except CircuitOpenError:
            logger.error(f"Circuit breaker open, cannot fetch {pipeline_name} pipeline")
            sync_state.record_error(
                "opportunities",
                f"Circuit breaker open for {pipeline_name} pipeline",
            )
            raise
        except Exception as e:
            logger.error(f"Failed to fetch {pipeline_name} pipeline: {e}")
            sync_state.record_error(
                "opportunities",
                str(e),
                {"pipeline": pipeline_name, "pipeline_id": pipeline_id},
            )
            raise

    total = len(all_opportunities)
    logger.info(f"Processing {total} opportunities total")

    for idx, (opportunity, pipeline_id) in enumerate(all_opportunities, 1):
        opp_id = opportunity.get("id", "unknown")
        opp_name = opportunity.get("name", "Unnamed")

        try:
            # Check if opportunity already exists in Baserow
            action, existing = deal_dedup.get_action(opportunity)

            # Try to find linked contact and buyer profile
            ghl_contact_id = opportunity.get("contact", {}).get("id") or opportunity.get("contactId")
            buyer_profile_id = None

            if ghl_contact_id:
                # Look up contact in Baserow
                contact = baserow_client.find_contact_by_ghl_id(ghl_contact_id)
                if contact:
                    # Look up buyer profile linked to this contact
                    buyer_profile = baserow_client.find_buyer_profile_by_contact(contact["id"])
                    if buyer_profile:
                        buyer_profile_id = buyer_profile["id"]

            # Transform opportunity to deal format
            deal_data = transform_opportunity_to_deal(opportunity, pipeline_id, buyer_profile_id)

            if action == "create":
                if dry_run:
                    logger.record_create(opp_name, f"[DRY RUN] Would create deal from {opp_id}")
                else:
                    result = baserow_client.create_deal(deal_data)
                    deal_dedup.add_to_index(opp_id, buyer_profile_id, opp_name, result)
                    logger.record_create(opp_name, f"Created deal ID {result.get('id')}")
                    sync_state.increment_synced("opportunities")

            elif action == "update":
                if dry_run:
                    logger.record_update(
                        opp_name,
                        f"[DRY RUN] Would update deal ID {existing['id']} from {opp_id}",
                    )
                else:
                    existing_id = existing["id"]
                    # Remove ghl_opportunity_id from update (already set)
                    del deal_data[f"field_{FIELD_IDS['ghl_opportunity_id']}"]
                    result = baserow_client.update_deal(existing_id, deal_data)
                    logger.record_update(opp_name, f"Updated deal ID {existing_id}")

            # Log progress every 10 records
            if idx % 10 == 0 or idx == total:
                logger.log_progress(idx, total)

        except CircuitOpenError:
            logger.record_error(opp_name, "Circuit breaker open")
            raise
        except Exception as e:
            logger.record_error(opp_name, str(e), {"ghl_id": opp_id})
            sync_state.record_error(
                "opportunities",
                str(e),
                {"opportunity_id": opp_id, "name": opp_name},
            )
            # Continue with next opportunity instead of failing entirely
            continue

    # Update sync state
    if not dry_run:
        sync_state.set_last_sync("opportunities")
        sync_state.clear_error("opportunities")

    return logger.end_sync(success=True)


# =============================================================================
# Main Entry Point
# =============================================================================

def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Sync GHL opportunities to Baserow deals",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/sync_opportunities.py           # Full sync
    python scripts/sync_opportunities.py --dry-run # Preview only
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without making them",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args()

    # Load environment variables
    env_path = PROJECT_ROOT / ".env"
    load_dotenv(env_path)

    # Validate required environment variables
    baserow_token = os.getenv("BASEROW_API_TOKEN")
    ghl_token = os.getenv("GHL_API_TOKEN")
    ghl_location = os.getenv("GHL_LOCATION_ID")

    missing = []
    if not baserow_token:
        missing.append("BASEROW_API_TOKEN")
    if not ghl_token:
        missing.append("GHL_API_TOKEN")
    if not ghl_location:
        missing.append("GHL_LOCATION_ID")

    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        print(f"Please set them in {env_path}")
        return 1

    # Initialize components
    logger = SyncLogger("opportunities")

    ghl_rate_limiter = RateLimiter(GHL_REQUESTS_PER_MINUTE)
    ghl_circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
    ghl_retry = RetryWithBackoff(max_retries=3, base_delay=1.0, max_delay=60.0)

    baserow_rate_limiter = RateLimiter(BASEROW_REQUESTS_PER_MINUTE)
    baserow_circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
    baserow_retry = RetryWithBackoff(max_retries=3, base_delay=1.0, max_delay=60.0)

    ghl_client = GHLClient(
        api_token=ghl_token,
        location_id=ghl_location,
        rate_limiter=ghl_rate_limiter,
        circuit_breaker=ghl_circuit_breaker,
        retry=ghl_retry,
        logger=logger,
    )

    baserow_client = BaserowClient(
        api_token=baserow_token,
        rate_limiter=baserow_rate_limiter,
        circuit_breaker=baserow_circuit_breaker,
        retry=baserow_retry,
        logger=logger,
    )

    sync_state = SyncState()

    # Fetch existing data for deduplication
    logger.info("Loading existing Baserow data for deduplication...")

    try:
        existing_contacts = fetch_baserow_contacts(baserow_token)
        contact_dedup = ContactDeduplicator(existing_contacts)
        logger.info(f"Indexed {len(existing_contacts)} existing contacts")

        existing_deals = fetch_baserow_deals(baserow_token)
        deal_dedup = OpportunityDeduplicator(existing_deals)
        logger.info(f"Indexed {len(existing_deals)} existing deals")

    except Exception as e:
        logger.error(f"Failed to load existing data: {e}")
        return 1

    # Run sync
    try:
        stats = sync_opportunities(
            ghl_client=ghl_client,
            baserow_client=baserow_client,
            contact_dedup=contact_dedup,
            deal_dedup=deal_dedup,
            sync_state=sync_state,
            logger=logger,
            dry_run=args.dry_run,
        )

        # Print summary
        print("\n" + "=" * 60)
        print("SYNC SUMMARY")
        print("=" * 60)
        print(f"  Created: {stats['created']}")
        print(f"  Updated: {stats['updated']}")
        print(f"  Skipped: {stats['skipped']}")
        print(f"  Errors:  {stats['errors']}")
        if stats.get("duration_seconds"):
            print(f"  Duration: {stats['duration_seconds']:.1f}s")
        print("=" * 60)

        if args.dry_run:
            print("\nDRY RUN - No changes were made")

        return 0 if stats["errors"] == 0 else 1

    except CircuitOpenError as e:
        logger.error(f"Sync aborted: {e}")
        return 1
    except KeyboardInterrupt:
        logger.warning("Sync interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
