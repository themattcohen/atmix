"""
Test Suite for Deduplication Utilities
======================================

Comprehensive tests for GHL -> Baserow deduplication logic.

Usage:
    pytest tests/test_deduplication.py -v
    pytest tests/test_deduplication.py -v -k "test_email"
    pytest tests/test_deduplication.py -v --tb=short

Author: Someday Consultants
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from utils.deduplication import (
    ContactDeduplicator,
    NewsletterDeduplicator,
    OpportunityDeduplicator,
    fetch_baserow_contacts,
    fetch_baserow_deals,
    normalize_email,
    normalize_name,
    normalize_phone,
)


# =============================================================================
# NORMALIZATION TESTS
# =============================================================================


class TestNormalizeEmail:
    """Tests for email normalization."""

    def test_lowercase_conversion(self):
        """Email should be converted to lowercase."""
        assert normalize_email("John.Doe@Example.COM") == "john.doe@example.com"
        assert normalize_email("UPPERCASE@DOMAIN.NET") == "uppercase@domain.net"

    def test_whitespace_stripping(self):
        """Leading and trailing whitespace should be removed."""
        assert normalize_email("  john@example.com  ") == "john@example.com"
        assert normalize_email("\tjohn@example.com\n") == "john@example.com"

    def test_combined_normalization(self):
        """Test combined case and whitespace normalization."""
        assert normalize_email("  JOHN.DOE@EXAMPLE.COM  ") == "john.doe@example.com"

    def test_none_input(self):
        """None should return empty string."""
        assert normalize_email(None) == ""

    def test_empty_string(self):
        """Empty string should return empty string."""
        assert normalize_email("") == ""

    def test_whitespace_only(self):
        """Whitespace-only string should return empty string."""
        assert normalize_email("   ") == ""

    def test_already_normalized(self):
        """Already normalized email should remain unchanged."""
        assert normalize_email("john@example.com") == "john@example.com"


class TestNormalizePhone:
    """Tests for phone number normalization."""

    def test_remove_dashes(self):
        """Dashes should be removed."""
        assert normalize_phone("303-555-1234") == "3035551234"

    def test_remove_parentheses(self):
        """Parentheses should be removed."""
        assert normalize_phone("(303) 555-1234") == "3035551234"

    def test_remove_country_code_formatting(self):
        """Country code with plus sign should be handled."""
        assert normalize_phone("+1 (303) 555-1234") == "13035551234"

    def test_remove_dots(self):
        """Dots should be removed."""
        assert normalize_phone("303.555.1234") == "3035551234"

    def test_remove_spaces(self):
        """Spaces should be removed."""
        assert normalize_phone("303 555 1234") == "3035551234"

    def test_mixed_formatting(self):
        """Mixed formatting characters should all be removed."""
        assert normalize_phone("+1-303-555-1234 ext. 123") == "13035551234123"

    def test_none_input(self):
        """None should return empty string."""
        assert normalize_phone(None) == ""

    def test_empty_string(self):
        """Empty string should return empty string."""
        assert normalize_phone("") == ""

    def test_already_digits_only(self):
        """Already digits-only should remain unchanged."""
        assert normalize_phone("3035551234") == "3035551234"

    def test_letters_removed(self):
        """Non-digit characters like letters should be removed."""
        assert normalize_phone("Call: 303-555-1234") == "3035551234"


class TestNormalizeName:
    """Tests for name normalization."""

    def test_lowercase_conversion(self):
        """Name should be converted to lowercase."""
        assert normalize_name("John Doe") == "john doe"
        assert normalize_name("SARA SHARP") == "sara sharp"

    def test_whitespace_stripping(self):
        """Leading and trailing whitespace should be removed."""
        assert normalize_name("  John Doe  ") == "john doe"

    def test_collapse_internal_whitespace(self):
        """Multiple internal spaces should collapse to single space."""
        assert normalize_name("John   Doe") == "john doe"
        assert normalize_name("John\t\tDoe") == "john doe"

    def test_combined_normalization(self):
        """Test combined case and whitespace normalization."""
        assert normalize_name("  JOHN   DOE  ") == "john doe"

    def test_none_input(self):
        """None should return empty string."""
        assert normalize_name(None) == ""

    def test_empty_string(self):
        """Empty string should return empty string."""
        assert normalize_name("") == ""

    def test_single_word(self):
        """Single word name should be handled."""
        assert normalize_name("Sara") == "sara"


# =============================================================================
# CONTACT DEDUPLICATOR TESTS
# =============================================================================


class TestContactDeduplicator:
    """Tests for ContactDeduplicator class."""

    @pytest.fixture
    def sample_baserow_contacts(self) -> list:
        """Sample Baserow contact records for testing."""
        return [
            {
                "id": 1,
                "ghl_contact_id": "ghl_abc123",
                "Email": "john@example.com",
                "Phone": "+1 (303) 555-1234",
                "Name": "John Doe",
            },
            {
                "id": 2,
                "ghl_contact_id": "ghl_def456",
                "Email": "sara@someday.com",
                "Phone": "720-555-5678",
                "Name": "Sara Sharp",
            },
            {
                "id": 3,
                "ghl_contact_id": None,  # No GHL ID
                "Email": "noid@example.com",
                "Phone": None,
                "Name": "No ID Contact",
            },
            {
                "id": 4,
                "ghl_contact_id": "",  # Empty GHL ID
                "Email": "",
                "Phone": "555-123-4567",
                "Name": "Phone Only",
            },
        ]

    @pytest.fixture
    def deduplicator(self, sample_baserow_contacts) -> ContactDeduplicator:
        """Create a ContactDeduplicator with sample data."""
        return ContactDeduplicator(sample_baserow_contacts)

    def test_initialization(self, sample_baserow_contacts):
        """Deduplicator should initialize with correct indexes."""
        dedup = ContactDeduplicator(sample_baserow_contacts)

        # Check GHL ID index (should have 2 entries with valid IDs)
        assert len(dedup.by_ghl_id) == 2
        assert "ghl_abc123" in dedup.by_ghl_id
        assert "ghl_def456" in dedup.by_ghl_id

        # Check email index
        assert len(dedup.by_email) == 3
        assert "john@example.com" in dedup.by_email
        assert "sara@someday.com" in dedup.by_email
        assert "noid@example.com" in dedup.by_email

        # Check phone index (10+ digits only)
        assert len(dedup.by_phone) == 3
        assert "13035551234" in dedup.by_phone
        assert "7205555678" in dedup.by_phone
        assert "5551234567" in dedup.by_phone

    def test_find_duplicate_by_ghl_id(self, deduplicator):
        """Should find duplicate by GHL contact ID."""
        ghl_contact = {
            "id": "ghl_abc123",
            "email": "different@email.com",
            "phone": "999-999-9999",
        }
        match = deduplicator.find_duplicate(ghl_contact)

        assert match is not None
        assert match["id"] == 1
        assert match["Name"] == "John Doe"

    def test_find_duplicate_by_email(self, deduplicator):
        """Should find duplicate by normalized email."""
        ghl_contact = {
            "id": "new_contact_id",
            "email": "  SARA@SOMEDAY.COM  ",  # Different case and whitespace
            "phone": "999-999-9999",
        }
        match = deduplicator.find_duplicate(ghl_contact)

        assert match is not None
        assert match["id"] == 2
        assert match["Name"] == "Sara Sharp"

    def test_find_duplicate_by_phone(self, deduplicator):
        """Should find duplicate by normalized phone."""
        ghl_contact = {
            "id": "new_contact_id",
            "email": "different@email.com",
            "phone": "(555) 123-4567",  # Different format, same digits
        }
        match = deduplicator.find_duplicate(ghl_contact)

        assert match is not None
        assert match["id"] == 4
        assert match["Name"] == "Phone Only"

    def test_find_duplicate_priority_ghl_id_over_email(self, deduplicator):
        """GHL ID match should take priority over email match."""
        ghl_contact = {
            "id": "ghl_abc123",  # Matches John Doe
            "email": "sara@someday.com",  # Also matches Sara Sharp
            "phone": "999-999-9999",
        }
        match = deduplicator.find_duplicate(ghl_contact)

        # Should match by GHL ID, not email
        assert match is not None
        assert match["id"] == 1
        assert match["Name"] == "John Doe"

    def test_find_duplicate_priority_email_over_phone(self, deduplicator):
        """Email match should take priority over phone match."""
        ghl_contact = {
            "id": "new_contact_id",
            "email": "john@example.com",  # Matches John Doe
            "phone": "720-555-5678",  # Also matches Sara Sharp
        }
        match = deduplicator.find_duplicate(ghl_contact)

        # Should match by email, not phone
        assert match is not None
        assert match["id"] == 1
        assert match["Name"] == "John Doe"

    def test_find_duplicate_no_match(self, deduplicator):
        """Should return None when no match found."""
        ghl_contact = {
            "id": "brand_new_id",
            "email": "brand_new@email.com",
            "phone": "999-888-7777",
        }
        match = deduplicator.find_duplicate(ghl_contact)

        assert match is None

    def test_find_duplicate_short_phone_ignored(self, deduplicator):
        """Phone numbers with fewer than 10 digits should not match."""
        ghl_contact = {
            "id": "new_id",
            "email": "new@email.com",
            "phone": "555-1234",  # Only 7 digits
        }
        match = deduplicator.find_duplicate(ghl_contact)

        assert match is None

    def test_get_action_create(self, deduplicator):
        """Should return 'create' action for new contacts."""
        ghl_contact = {
            "id": "brand_new_id",
            "email": "brand_new@email.com",
        }
        action, existing = deduplicator.get_action(ghl_contact)

        assert action == "create"
        assert existing is None

    def test_get_action_update(self, deduplicator):
        """Should return 'update' action for existing contacts."""
        ghl_contact = {
            "id": "ghl_abc123",
            "email": "john@example.com",
        }
        action, existing = deduplicator.get_action(ghl_contact)

        assert action == "update"
        assert existing is not None
        assert existing["id"] == 1

    def test_empty_contacts_list(self):
        """Should handle empty contacts list."""
        dedup = ContactDeduplicator([])

        ghl_contact = {
            "id": "any_id",
            "email": "any@email.com",
        }
        match = dedup.find_duplicate(ghl_contact)

        assert match is None
        assert len(dedup.by_ghl_id) == 0
        assert len(dedup.by_email) == 0
        assert len(dedup.by_phone) == 0

    def test_add_to_index(self, deduplicator):
        """Should add new records to indexes."""
        new_record = {
            "id": 100,
            "Name": "New Person",
        }

        deduplicator.add_to_index(
            ghl_id="new_ghl_id",
            email="New@Person.com",
            phone="+1 (555) 999-8888",
            record=new_record,
        )

        # Verify indexes updated
        assert "new_ghl_id" in deduplicator.by_ghl_id
        assert "new@person.com" in deduplicator.by_email
        assert "15559998888" in deduplicator.by_phone

        # Verify the record is correct
        assert deduplicator.by_ghl_id["new_ghl_id"]["id"] == 100

    def test_alternative_field_names(self):
        """Should handle alternative field names for GHL ID."""
        contacts = [
            {"id": 1, "GHL Contact ID": "alt_id_1", "email": "alt1@test.com"},
            {"id": 2, "ghl_id": "alt_id_2", "email": "alt2@test.com"},
        ]
        dedup = ContactDeduplicator(contacts)

        assert "alt_id_1" in dedup.by_ghl_id
        assert "alt_id_2" in dedup.by_ghl_id


# =============================================================================
# OPPORTUNITY DEDUPLICATOR TESTS
# =============================================================================


class TestOpportunityDeduplicator:
    """Tests for OpportunityDeduplicator class."""

    @pytest.fixture
    def sample_baserow_deals(self) -> list:
        """Sample Baserow deal records for testing."""
        return [
            {
                "id": 1,
                "ghl_opportunity_id": "opp_123",
                "Deal Name": "ABC Firm Acquisition",
                "Contact": [{"id": 10, "value": "John Doe"}],
            },
            {
                "id": 2,
                "ghl_opportunity_id": "opp_456",
                "Deal Name": "XYZ Practice Sale",
                "Contact": [{"id": 20, "value": "Sara Sharp"}],
            },
            {
                "id": 3,
                "ghl_opportunity_id": None,
                "Deal Name": "No GHL ID Deal",
                "Contact": [{"id": 30, "value": "Other Person"}],
            },
        ]

    @pytest.fixture
    def deduplicator(self, sample_baserow_deals) -> OpportunityDeduplicator:
        """Create an OpportunityDeduplicator with sample data."""
        return OpportunityDeduplicator(sample_baserow_deals)

    def test_initialization(self, sample_baserow_deals):
        """Deduplicator should initialize with correct indexes."""
        dedup = OpportunityDeduplicator(sample_baserow_deals)

        # Check GHL ID index
        assert len(dedup.by_ghl_id) == 2
        assert "opp_123" in dedup.by_ghl_id
        assert "opp_456" in dedup.by_ghl_id

        # Check composite key index
        assert len(dedup.by_composite) == 3
        assert "10:ABC Firm Acquisition" in dedup.by_composite
        assert "20:XYZ Practice Sale" in dedup.by_composite
        assert "30:No GHL ID Deal" in dedup.by_composite

    def test_find_duplicate_by_ghl_id(self, deduplicator):
        """Should find duplicate by GHL opportunity ID."""
        ghl_opp = {
            "id": "opp_123",
            "name": "Different Name",
        }
        match = deduplicator.find_duplicate(ghl_opp)

        assert match is not None
        assert match["id"] == 1
        assert match["Deal Name"] == "ABC Firm Acquisition"

    def test_find_duplicate_by_composite_key(self, deduplicator):
        """Should find duplicate by composite key."""
        ghl_opp = {
            "id": "new_opp_id",
            "name": "No GHL ID Deal",
        }
        match = deduplicator.find_duplicate(ghl_opp, contact_baserow_id=30)

        assert match is not None
        assert match["id"] == 3

    def test_find_duplicate_no_match(self, deduplicator):
        """Should return None when no match found."""
        ghl_opp = {
            "id": "brand_new_opp",
            "name": "Brand New Deal",
        }
        match = deduplicator.find_duplicate(ghl_opp, contact_baserow_id=999)

        assert match is None

    def test_find_duplicate_priority_ghl_id_over_composite(self, deduplicator):
        """GHL ID should take priority over composite key."""
        ghl_opp = {
            "id": "opp_123",  # Matches deal 1
            "name": "XYZ Practice Sale",  # Would match deal 2 with contact 20
        }
        match = deduplicator.find_duplicate(ghl_opp, contact_baserow_id=20)

        # Should match by GHL ID
        assert match is not None
        assert match["id"] == 1

    def test_get_action_create(self, deduplicator):
        """Should return 'create' action for new opportunities."""
        ghl_opp = {"id": "new_opp", "name": "New Deal"}
        action, existing = deduplicator.get_action(ghl_opp, contact_baserow_id=999)

        assert action == "create"
        assert existing is None

    def test_get_action_update(self, deduplicator):
        """Should return 'update' action for existing opportunities."""
        ghl_opp = {"id": "opp_456", "name": "XYZ Practice Sale"}
        action, existing = deduplicator.get_action(ghl_opp)

        assert action == "update"
        assert existing is not None
        assert existing["id"] == 2

    def test_empty_deals_list(self):
        """Should handle empty deals list."""
        dedup = OpportunityDeduplicator([])

        ghl_opp = {"id": "any_id", "name": "Any Deal"}
        match = dedup.find_duplicate(ghl_opp)

        assert match is None

    def test_add_to_index(self, deduplicator):
        """Should add new records to indexes."""
        new_record = {"id": 100, "Deal Name": "New Deal"}

        deduplicator.add_to_index(
            ghl_id="new_opp_id",
            contact_baserow_id=50,
            deal_name="New Deal",
            record=new_record,
        )

        assert "new_opp_id" in deduplicator.by_ghl_id
        assert "50:New Deal" in deduplicator.by_composite

    def test_alternative_field_names(self):
        """Should handle alternative field names."""
        deals = [
            {"id": 1, "GHL Opportunity ID": "alt_id", "Name": "Deal 1", "Contact": []},
        ]
        dedup = OpportunityDeduplicator(deals)

        assert "alt_id" in dedup.by_ghl_id

    def test_empty_contact_link(self):
        """Should handle empty contact link array."""
        deals = [
            {"id": 1, "ghl_opportunity_id": "opp_1", "Deal Name": "Deal", "Contact": []},
        ]
        dedup = OpportunityDeduplicator(deals)

        # GHL ID should be indexed
        assert "opp_1" in dedup.by_ghl_id
        # Composite should not be indexed (no contact ID)
        assert len(dedup.by_composite) == 0


# =============================================================================
# NEWSLETTER DEDUPLICATOR TESTS
# =============================================================================


class TestNewsletterDeduplicator:
    """Tests for NewsletterDeduplicator class."""

    @pytest.fixture
    def sample_subjects(self) -> set:
        """Sample existing newsletter subjects."""
        return {
            "Newsletter #1: Getting Started",
            "Newsletter #2: Advanced Topics",
            "The Compliance Mistake That Could Tank Your Deal",
        }

    @pytest.fixture
    def deduplicator(self, sample_subjects) -> NewsletterDeduplicator:
        """Create a NewsletterDeduplicator with sample data."""
        return NewsletterDeduplicator(sample_subjects)

    def test_initialization(self, sample_subjects):
        """Deduplicator should initialize with provided subjects."""
        dedup = NewsletterDeduplicator(sample_subjects)
        assert len(dedup.existing_subjects) == 3

    def test_initialization_empty(self):
        """Should handle initialization without subjects."""
        dedup = NewsletterDeduplicator()
        assert len(dedup.existing_subjects) == 0

    def test_initialization_none(self):
        """Should handle None subjects."""
        dedup = NewsletterDeduplicator(None)
        assert len(dedup.existing_subjects) == 0

    def test_is_duplicate_true(self, deduplicator):
        """Should detect existing subjects as duplicates."""
        assert deduplicator.is_duplicate("Newsletter #1: Getting Started") is True
        assert deduplicator.is_duplicate("Newsletter #2: Advanced Topics") is True

    def test_is_duplicate_false(self, deduplicator):
        """Should not detect new subjects as duplicates."""
        assert deduplicator.is_duplicate("Newsletter #99: New Content") is False
        assert deduplicator.is_duplicate("Brand New Newsletter") is False

    def test_is_duplicate_case_sensitive(self, deduplicator):
        """Subject matching should be case-sensitive."""
        # Different case = not a duplicate
        assert deduplicator.is_duplicate("newsletter #1: getting started") is False
        assert deduplicator.is_duplicate("NEWSLETTER #1: GETTING STARTED") is False

    def test_add_subject(self, deduplicator):
        """Should add new subjects to the set."""
        new_subject = "Newsletter #3: New Topic"

        assert deduplicator.is_duplicate(new_subject) is False
        deduplicator.add(new_subject)
        assert deduplicator.is_duplicate(new_subject) is True

    def test_get_action_skip(self, deduplicator):
        """Should return 'skip' for existing subjects."""
        action = deduplicator.get_action("Newsletter #1: Getting Started")
        assert action == "skip"

    def test_get_action_create(self, deduplicator):
        """Should return 'create' for new subjects."""
        action = deduplicator.get_action("Brand New Newsletter")
        assert action == "create"


# =============================================================================
# FETCH FUNCTION TESTS
# =============================================================================


class TestFetchBaserowContacts:
    """Tests for fetch_baserow_contacts function."""

    def test_single_page_response(self):
        """Should handle single page of results."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "Email": "test1@example.com"},
                {"id": 2, "Email": "test2@example.com"},
            ],
            "next": None,
        }
        mock_response.raise_for_status = MagicMock()

        with patch("requests.get", return_value=mock_response) as mock_get:
            contacts = fetch_baserow_contacts("test_token", table_id=12345)

        assert len(contacts) == 2
        assert contacts[0]["Email"] == "test1@example.com"
        mock_get.assert_called_once()

    def test_paginated_response(self):
        """Should handle paginated results."""
        page1_response = MagicMock()
        page1_response.json.return_value = {
            "results": [{"id": 1, "Email": "test1@example.com"}],
            "next": "https://api.baserow.io/page2",
        }
        page1_response.raise_for_status = MagicMock()

        page2_response = MagicMock()
        page2_response.json.return_value = {
            "results": [{"id": 2, "Email": "test2@example.com"}],
            "next": None,
        }
        page2_response.raise_for_status = MagicMock()

        with patch("requests.get", side_effect=[page1_response, page2_response]):
            contacts = fetch_baserow_contacts("test_token")

        assert len(contacts) == 2

    def test_api_error_raised(self):
        """Should propagate HTTP errors."""
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("API Error")

        with patch("requests.get", return_value=mock_response):
            with pytest.raises(Exception, match="API Error"):
                fetch_baserow_contacts("test_token")


class TestFetchBaserowDeals:
    """Tests for fetch_baserow_deals function."""

    def test_single_page_response(self):
        """Should handle single page of results."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "Deal Name": "Deal 1"},
                {"id": 2, "Deal Name": "Deal 2"},
            ],
            "next": None,
        }
        mock_response.raise_for_status = MagicMock()

        with patch("requests.get", return_value=mock_response) as mock_get:
            deals = fetch_baserow_deals("test_token", table_id=12345)

        assert len(deals) == 2
        assert deals[0]["Deal Name"] == "Deal 1"
        mock_get.assert_called_once()

    def test_default_table_id(self):
        """Should use default table ID for deals."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": [], "next": None}
        mock_response.raise_for_status = MagicMock()

        with patch("requests.get", return_value=mock_response) as mock_get:
            fetch_baserow_deals("test_token")

        # Verify URL contains default table ID
        call_url = mock_get.call_args[0][0]
        assert "817373" in call_url


# =============================================================================
# EDGE CASE TESTS
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and unusual inputs."""

    def test_contact_with_all_none_values(self):
        """Should handle contacts with all None values."""
        contacts = [
            {
                "id": 1,
                "ghl_contact_id": None,
                "Email": None,
                "Phone": None,
                "Name": None,
            }
        ]
        dedup = ContactDeduplicator(contacts)

        # Should have no indexed values
        assert len(dedup.by_ghl_id) == 0
        assert len(dedup.by_email) == 0
        assert len(dedup.by_phone) == 0

    def test_contact_with_empty_string_values(self):
        """Should handle contacts with empty string values."""
        contacts = [
            {"id": 1, "ghl_contact_id": "", "Email": "", "Phone": "", "Name": ""}
        ]
        dedup = ContactDeduplicator(contacts)

        assert len(dedup.by_ghl_id) == 0
        assert len(dedup.by_email) == 0
        assert len(dedup.by_phone) == 0

    def test_unicode_in_email(self):
        """Should handle unicode characters in email."""
        # Note: normalize_email only handles case and whitespace
        assert normalize_email("tëst@example.com") == "tëst@example.com"

    def test_unicode_in_name(self):
        """Should handle unicode characters in name."""
        assert normalize_name("José García") == "josé garcía"

    def test_phone_with_extension(self):
        """Should include extension digits in normalized phone."""
        assert normalize_phone("303-555-1234 ext 567") == "3035551234567"

    def test_international_phone(self):
        """Should handle international phone numbers."""
        assert normalize_phone("+44 20 7123 4567") == "442071234567"

    def test_ghl_contact_minimal_data(self):
        """Should handle GHL contact with minimal data."""
        dedup = ContactDeduplicator([])

        ghl_contact = {}  # Empty contact
        match = dedup.find_duplicate(ghl_contact)
        assert match is None

        ghl_contact = {"id": None, "email": None, "phone": None}
        match = dedup.find_duplicate(ghl_contact)
        assert match is None

    def test_multiple_contacts_same_email(self):
        """Last contact with same email should be in index (overwrites)."""
        contacts = [
            {"id": 1, "Email": "same@example.com", "Name": "First"},
            {"id": 2, "Email": "same@example.com", "Name": "Second"},
        ]
        dedup = ContactDeduplicator(contacts)

        # Second contact should be indexed (overwrites first)
        assert dedup.by_email["same@example.com"]["id"] == 2

    def test_very_long_phone_number(self):
        """Should handle very long phone numbers."""
        long_phone = "1" * 20  # 20 digits
        assert normalize_phone(long_phone) == long_phone
        assert len(normalize_phone(long_phone)) >= 10

    def test_whitespace_only_email(self):
        """Should treat whitespace-only email as empty."""
        contacts = [{"id": 1, "Email": "   \t\n   "}]
        dedup = ContactDeduplicator(contacts)
        assert len(dedup.by_email) == 0


# =============================================================================
# MAIN
# =============================================================================


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
