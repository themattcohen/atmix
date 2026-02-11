"""
Deduplication utilities for GHL -> Baserow sync.

Handles contact, opportunity, and newsletter deduplication with multiple
matching strategies and priority-based resolution.

Usage:
    from scripts.utils.deduplication import ContactDeduplicator

    # Fetch existing contacts from Baserow
    existing = fetch_baserow_contacts(api_token, table_id)

    # Create deduplicator with indexed lookups
    dedup = ContactDeduplicator(existing)

    # Check each GHL contact
    for ghl_contact in ghl_contacts:
        action, existing_record = dedup.get_action(ghl_contact)
        if action == 'create':
            # Create new Baserow record
            pass
        elif action == 'update':
            # Update existing_record with new data
            pass

Author: Someday Consultants
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional


def normalize_email(email: str | None) -> str:
    """
    Normalize email for comparison.

    Transformations applied:
    - Convert to lowercase
    - Strip leading/trailing whitespace
    - Handle None/empty values

    Args:
        email: Raw email string, may be None

    Returns:
        Normalized email string, empty string if input is None/empty

    Examples:
        >>> normalize_email("  John.Doe@Example.COM  ")
        'john.doe@example.com'
        >>> normalize_email(None)
        ''
        >>> normalize_email("")
        ''
    """
    if not email:
        return ""
    return email.lower().strip()


def normalize_phone(phone: str | None) -> str:
    """
    Normalize phone number for comparison.

    Transformations applied:
    - Remove all non-digit characters
    - Handle None/empty values

    Args:
        phone: Raw phone string, may contain formatting

    Returns:
        Digits-only phone string, empty string if input is None/empty

    Examples:
        >>> normalize_phone("+1 (303) 555-1234")
        '13035551234'
        >>> normalize_phone("303.555.1234")
        '3035551234'
        >>> normalize_phone(None)
        ''
    """
    if not phone:
        return ""
    return re.sub(r"[^\d]", "", phone)


def normalize_name(name: str | None) -> str:
    """
    Normalize name for comparison.

    Transformations applied:
    - Convert to lowercase
    - Strip leading/trailing whitespace
    - Collapse multiple whitespace to single space
    - Handle None/empty values

    Args:
        name: Raw name string

    Returns:
        Normalized name string, empty string if input is None/empty

    Examples:
        >>> normalize_name("  John   Doe  ")
        'john doe'
        >>> normalize_name("SARA SHARP")
        'sara sharp'
        >>> normalize_name(None)
        ''
    """
    if not name:
        return ""
    return " ".join(name.lower().split())


@dataclass
class ContactDeduplicator:
    """
    Deduplication strategy for contacts.

    Priority order for matching:
    1. GHL Contact ID (exact match, most reliable)
    2. Email (normalized comparison)
    3. Phone (normalized, minimum 10 digits)

    The deduplicator builds efficient lookup indexes on initialization
    for O(1) duplicate detection.

    Attributes:
        contacts: List of existing Baserow contact records
        by_ghl_id: Index mapping GHL contact ID to Baserow record
        by_email: Index mapping normalized email to Baserow record
        by_phone: Index mapping normalized phone to Baserow record

    Example:
        >>> existing = fetch_baserow_contacts(api_token, 817355)
        >>> dedup = ContactDeduplicator(existing)
        >>> match = dedup.find_duplicate(ghl_contact)
        >>> if match:
        ...     print(f"Found existing contact: {match['id']}")
    """

    contacts: list[dict[str, Any]]
    by_ghl_id: dict[str, dict[str, Any]] = field(default_factory=dict, init=False)
    by_email: dict[str, dict[str, Any]] = field(default_factory=dict, init=False)
    by_phone: dict[str, dict[str, Any]] = field(default_factory=dict, init=False)

    def __post_init__(self) -> None:
        """Build lookup indexes after initialization."""
        self._build_indexes()

    def _build_indexes(self) -> None:
        """
        Build lookup indexes for fast deduplication.

        Creates three hash maps for O(1) lookup:
        - by_ghl_id: Maps GHL contact ID to Baserow record
        - by_email: Maps normalized email to Baserow record
        - by_phone: Maps normalized phone (10+ digits) to Baserow record

        Note: Baserow API returns fields as field_XXXXX where XXXXX is the field ID.
        Field IDs:
        - ghl_contact_id: 7014113
        - Email: 7012618
        - Phone: 7012619
        """
        self.by_ghl_id = {}
        self.by_email = {}
        self.by_phone = {}

        for contact in self.contacts:
            # Index by GHL ID (primary identifier)
            # Check multiple possible field formats
            ghl_id = (
                contact.get("field_7014113")  # Baserow field ID format
                or contact.get("ghl_contact_id")
                or contact.get("GHL Contact ID")
                or contact.get("ghl_id")
            )
            if ghl_id:
                self.by_ghl_id[str(ghl_id)] = contact

            # Index by normalized email
            email = normalize_email(
                contact.get("field_7012618")  # Baserow field ID format
                or contact.get("Email")
                or contact.get("email")
            )
            if email:
                self.by_email[email] = contact

            # Index by normalized phone (must have at least 10 digits)
            phone = normalize_phone(
                contact.get("field_7012619")  # Baserow field ID format
                or contact.get("Phone")
                or contact.get("phone")
            )
            if phone and len(phone) >= 10:
                self.by_phone[phone] = contact

    def find_duplicate(
        self, ghl_contact: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        """
        Find existing Baserow contact matching a GHL contact.

        Matching priority:
        1. GHL Contact ID - Most reliable, direct system link
        2. Email - Strong identifier, normalized comparison
        3. Phone - Fallback for contacts without email

        Args:
            ghl_contact: Contact data from GHL API

        Returns:
            Matching Baserow contact dict if found, None if new contact

        Example:
            >>> match = dedup.find_duplicate({
            ...     "id": "abc123",
            ...     "email": "john@example.com",
            ...     "phone": "+1-303-555-1234"
            ... })
        """
        # Priority 1: Match by GHL Contact ID (most reliable)
        ghl_id = ghl_contact.get("id")
        if ghl_id and str(ghl_id) in self.by_ghl_id:
            return self.by_ghl_id[str(ghl_id)]

        # Priority 2: Match by normalized email
        email = normalize_email(ghl_contact.get("email"))
        if email and email in self.by_email:
            return self.by_email[email]

        # Priority 3: Match by normalized phone (10+ digits required)
        phone = normalize_phone(ghl_contact.get("phone"))
        if phone and len(phone) >= 10 and phone in self.by_phone:
            return self.by_phone[phone]

        return None  # New contact, no match found

    def get_action(
        self, ghl_contact: dict[str, Any]
    ) -> tuple[str, Optional[dict[str, Any]]]:
        """
        Determine sync action for a GHL contact.

        Args:
            ghl_contact: Contact data from GHL API

        Returns:
            Tuple of (action, existing_contact):
            - ('create', None) - New contact, create in Baserow
            - ('update', existing_dict) - Existing contact, update with new data

        Example:
            >>> action, existing = dedup.get_action(ghl_contact)
            >>> if action == 'create':
            ...     baserow.create_row(table_id, transform(ghl_contact))
            >>> elif action == 'update':
            ...     baserow.update_row(table_id, existing['id'], transform(ghl_contact))
        """
        existing = self.find_duplicate(ghl_contact)
        if existing:
            return ("update", existing)
        return ("create", None)

    def add_to_index(self, ghl_id: str, email: str, phone: str, record: dict[str, Any]) -> None:
        """
        Add a newly created record to the indexes.

        Call this after creating a new Baserow record to keep indexes current
        during batch operations.

        Args:
            ghl_id: GHL contact ID
            email: Raw email (will be normalized)
            phone: Raw phone (will be normalized)
            record: The Baserow record that was created
        """
        if ghl_id:
            self.by_ghl_id[str(ghl_id)] = record

        norm_email = normalize_email(email)
        if norm_email:
            self.by_email[norm_email] = record

        norm_phone = normalize_phone(phone)
        if norm_phone and len(norm_phone) >= 10:
            self.by_phone[norm_phone] = record


@dataclass
class OpportunityDeduplicator:
    """
    Deduplication strategy for opportunities/deals.

    Priority order for matching:
    1. GHL Opportunity ID (exact match)
    2. Composite key: Contact ID + Deal Name

    Attributes:
        deals: List of existing Baserow deal records
        by_ghl_id: Index mapping GHL opportunity ID to Baserow record
        by_composite: Index mapping "contact_id:deal_name" to Baserow record

    Example:
        >>> existing = fetch_baserow_deals(api_token, 817373)
        >>> dedup = OpportunityDeduplicator(existing)
        >>> match = dedup.find_duplicate(ghl_opportunity, contact_baserow_id=123)
    """

    deals: list[dict[str, Any]]
    by_ghl_id: dict[str, dict[str, Any]] = field(default_factory=dict, init=False)
    by_composite: dict[str, dict[str, Any]] = field(default_factory=dict, init=False)

    def __post_init__(self) -> None:
        """Build lookup indexes after initialization."""
        self._build_indexes()

    def _build_indexes(self) -> None:
        """
        Build lookup indexes for opportunity deduplication.

        Creates two hash maps:
        - by_ghl_id: Maps GHL opportunity ID to Baserow record
        - by_composite: Maps "contact_id:deal_name" to Baserow record

        Note: Baserow API returns fields as field_XXXXX where XXXXX is the field ID.
        Field IDs:
        - ghl_opportunity_id: 7014114
        - Deal Name: 7012683
        - Buyer (link): 7012687
        """
        self.by_ghl_id = {}
        self.by_composite = {}

        for deal in self.deals:
            # Index by GHL Opportunity ID
            # Check multiple possible field formats
            ghl_id = (
                deal.get("field_7014114")  # Baserow field ID format
                or deal.get("ghl_opportunity_id")
                or deal.get("GHL Opportunity ID")
                or deal.get("ghl_id")
            )
            if ghl_id:
                self.by_ghl_id[str(ghl_id)] = deal

            # Composite key: buyer link + deal name
            # Baserow linked fields return as list of dicts with 'id' and 'value'
            buyer_link = deal.get("field_7012687") or deal.get("Buyer") or []
            buyer_id = None
            if isinstance(buyer_link, list) and len(buyer_link) > 0:
                buyer_id = buyer_link[0].get("id")

            deal_name = (
                deal.get("field_7012683")  # Baserow field ID format
                or deal.get("Deal Name")
                or deal.get("Name")
                or ""
            )

            if buyer_id and deal_name:
                key = f"{buyer_id}:{deal_name}"
                self.by_composite[key] = deal

    def find_duplicate(
        self,
        ghl_opportunity: dict[str, Any],
        contact_baserow_id: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Find existing Baserow deal matching a GHL opportunity.

        Args:
            ghl_opportunity: Opportunity data from GHL API
            contact_baserow_id: Baserow ID of the linked contact (for composite matching)

        Returns:
            Matching Baserow deal dict if found, None if new opportunity
        """
        # Priority 1: Match by GHL Opportunity ID
        ghl_id = ghl_opportunity.get("id")
        if ghl_id and str(ghl_id) in self.by_ghl_id:
            return self.by_ghl_id[str(ghl_id)]

        # Priority 2: Composite key match (contact + deal name)
        if contact_baserow_id:
            deal_name = ghl_opportunity.get("name") or ""
            key = f"{contact_baserow_id}:{deal_name}"
            if key in self.by_composite:
                return self.by_composite[key]

        return None  # New opportunity

    def get_action(
        self,
        ghl_opportunity: dict[str, Any],
        contact_baserow_id: Optional[int] = None,
    ) -> tuple[str, Optional[dict[str, Any]]]:
        """
        Determine sync action for a GHL opportunity.

        Args:
            ghl_opportunity: Opportunity data from GHL API
            contact_baserow_id: Baserow ID of the linked contact

        Returns:
            Tuple of (action, existing_deal):
            - ('create', None) - New opportunity, create in Baserow
            - ('update', existing_dict) - Existing deal, update with new data
        """
        existing = self.find_duplicate(ghl_opportunity, contact_baserow_id)
        if existing:
            return ("update", existing)
        return ("create", None)

    def add_to_index(
        self,
        ghl_id: str,
        contact_baserow_id: Optional[int],
        deal_name: str,
        record: dict[str, Any],
    ) -> None:
        """
        Add a newly created deal to the indexes.

        Args:
            ghl_id: GHL opportunity ID
            contact_baserow_id: Baserow ID of linked contact
            deal_name: Name of the deal
            record: The Baserow record that was created
        """
        if ghl_id:
            self.by_ghl_id[str(ghl_id)] = record

        if contact_baserow_id and deal_name:
            key = f"{contact_baserow_id}:{deal_name}"
            self.by_composite[key] = record


class NewsletterDeduplicator:
    """
    Deduplication for newsletters.

    Uses subject line as the primary deduplication key since newsletters
    are uniquely identified by their subject within the system.

    Attributes:
        existing_subjects: Set of newsletter subjects already in the system

    Example:
        >>> existing = {"Newsletter #1", "Newsletter #2"}
        >>> dedup = NewsletterDeduplicator(existing)
        >>> if not dedup.is_duplicate("Newsletter #3"):
        ...     create_newsletter("Newsletter #3", content)
        ...     dedup.add("Newsletter #3")
    """

    def __init__(self, existing_subjects: Optional[set[str]] = None) -> None:
        """
        Initialize with existing newsletter subjects.

        Args:
            existing_subjects: Set of subject lines already in the system
        """
        self.existing_subjects: set[str] = existing_subjects or set()

    def is_duplicate(self, subject: str) -> bool:
        """
        Check if a newsletter with this subject already exists.

        Args:
            subject: Newsletter subject line to check

        Returns:
            True if subject already exists, False if new
        """
        return subject in self.existing_subjects

    def add(self, subject: str) -> None:
        """
        Add a subject to the existing set.

        Call after successfully creating a new newsletter record.

        Args:
            subject: Newsletter subject line to add
        """
        self.existing_subjects.add(subject)

    def get_action(self, subject: str) -> str:
        """
        Determine sync action for a newsletter.

        Args:
            subject: Newsletter subject line

        Returns:
            'skip' if duplicate, 'create' if new
        """
        if self.is_duplicate(subject):
            return "skip"
        return "create"


def fetch_baserow_contacts(
    api_token: str,
    table_id: int = 817355,
    base_url: str = "https://api.baserow.io",
) -> list[dict[str, Any]]:
    """
    Fetch all contacts from Baserow for deduplication indexing.

    Handles pagination automatically to retrieve all records.

    Args:
        api_token: Baserow API token
        table_id: Baserow table ID (default: 817355 for Contacts)
        base_url: Baserow API base URL

    Returns:
        List of all contact records from Baserow

    Raises:
        requests.HTTPError: If API request fails

    Example:
        >>> contacts = fetch_baserow_contacts(os.environ['BASEROW_API_TOKEN'])
        >>> print(f"Loaded {len(contacts)} contacts for deduplication")
    """
    import requests

    contacts: list[dict[str, Any]] = []
    url: Optional[str] = f"{base_url}/api/database/rows/table/{table_id}/"
    headers = {"Authorization": f"Token {api_token}"}

    while url:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        contacts.extend(data.get("results", []))
        url = data.get("next")  # Pagination URL or None

    return contacts


def fetch_baserow_deals(
    api_token: str,
    table_id: int = 817373,
    base_url: str = "https://api.baserow.io",
) -> list[dict[str, Any]]:
    """
    Fetch all deals from Baserow for deduplication indexing.

    Handles pagination automatically to retrieve all records.

    Args:
        api_token: Baserow API token
        table_id: Baserow table ID (default: 817373 for Deals)
        base_url: Baserow API base URL

    Returns:
        List of all deal records from Baserow

    Raises:
        requests.HTTPError: If API request fails

    Example:
        >>> deals = fetch_baserow_deals(os.environ['BASEROW_API_TOKEN'])
        >>> print(f"Loaded {len(deals)} deals for deduplication")
    """
    import requests

    deals: list[dict[str, Any]] = []
    url: Optional[str] = f"{base_url}/api/database/rows/table/{table_id}/"
    headers = {"Authorization": f"Token {api_token}"}

    while url:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        deals.extend(data.get("results", []))
        url = data.get("next")  # Pagination URL or None

    return deals
