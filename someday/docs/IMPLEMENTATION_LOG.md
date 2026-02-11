# GHL-Baserow Integration Implementation Log

## 2026-01-27: Schema Changes via JWT Authentication (SOLVED)

### Problem
Baserow database tokens (`BASEROW_API_TOKEN`) can only perform row-level CRUD operations. They **cannot** modify schema (add fields, change field options).

### Solution: JWT Authentication
Baserow supports two auth methods:

| Method | Token Type | Row CRUD | Schema Changes | Expiration |
|--------|-----------|----------|----------------|------------|
| Database Token | `Token {token}` | ✅ | ❌ | Never |
| JWT Auth | `JWT {token}` | ✅ | ✅ | 10-15 min |

To get a JWT token, authenticate with email/password:

```python
import requests

# Get JWT token
resp = requests.post(
    "https://api.baserow.io/api/user/token-auth/",
    json={"email": "BASEROW_EMAIL", "password": "BASEROW_PASSWORD"}
)
jwt_token = resp.json()["access_token"]

# Use JWT for schema operations
headers = {"Authorization": f"JWT {jwt_token}", "Content-Type": "application/json"}

# Create new field
requests.post(
    "https://api.baserow.io/api/database/fields/table/{table_id}/",
    headers=headers,
    json={"name": "field_name", "type": "text"}
)

# Update select options
requests.patch(
    "https://api.baserow.io/api/database/fields/{field_id}/",
    headers=headers,
    json={"select_options": [{"value": "New Option", "color": "blue"}]}
)
```

### Environment Variables Added
```
BASEROW_EMAIL=matt@atmix.org
BASEROW_PASSWORD=yRNAZLOP7$c%V1JL
```

### Fields Created Successfully
| Table | Field | Field ID | Type |
|-------|-------|----------|------|
| Contacts (817355) | ghl_contact_id | **7014113** | text |
| Deals (817373) | ghl_opportunity_id | **7014114** | text |

### Select Option Added
| Table | Field | Option | Option ID |
|-------|-------|--------|-----------|
| Contacts (817355) | Source (7012624) | Deal Academy | **5148110** |

### Key Insight
- Use `BASEROW_API_TOKEN` for sync scripts (row operations)
- Use JWT auth (from `BASEROW_EMAIL`/`BASEROW_PASSWORD`) only when schema changes are needed
- JWT tokens expire quickly, so get a fresh one for each schema operation session

---

## 2026-01-27: State Persistence and Infrastructure Implementation

### Objective
Create state management, rate limiting, and logging infrastructure for GHL to Baserow sync operations.

### Implementation Summary

**Files Created:**
- `/scripts/utils/sync_state.py` - Sync state persistence with JSON file storage
- `/scripts/utils/rate_limiter.py` - Rate limiting, circuit breaker, and retry patterns
- `/scripts/utils/logging_config.py` - Structured logging configuration
- `/tests/test_infrastructure.py` - Comprehensive test suite (54 tests)

**Files Updated:**
- `/scripts/utils/__init__.py` - Added exports for new modules

### Components

#### SyncState - State Persistence
Tracks last sync times, cursors, and error states for each entity type.

```python
from scripts.utils import SyncState

# Initialize state (loads from data/sync_state.json)
state = SyncState()

# Track sync progress
state.set_last_sync("contacts")
state.increment_synced("contacts", count=50)
state.set_cursor("contacts", "next_page_cursor")

# Error tracking
state.record_error("contacts", "API timeout", context={"batch": 3})
if state.has_error("contacts"):
    # Handle recovery
    state.clear_error("contacts")

# Get summary for monitoring
summary = state.get_summary()
# {'contacts': {'last_sync': '2026-01-27T...', 'total_synced': 50, 'has_error': False}}
```

**State File Location**: `data/sync_state.json`

#### RateLimiter - API Rate Limiting
Token bucket rate limiter to prevent API throttling.

```python
from scripts.utils import RateLimiter, rate_limited

# Direct usage
limiter = RateLimiter(requests_per_minute=60)
for record in records:
    limiter.wait()  # Blocks until rate limit allows
    api.create(record)

# Decorator usage
@rate_limited(requests_per_minute=60)
def fetch_contact(contact_id):
    return ghl_api.get_contact(contact_id)
```

#### CircuitBreaker - Fault Tolerance
Prevents cascading failures when APIs are unavailable.

```python
from scripts.utils import CircuitBreaker, with_circuit_breaker, CircuitOpenError

# Direct usage
breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
try:
    result = breaker.call(api.fetch_data)
except CircuitOpenError:
    # Service unavailable, use fallback
    pass

# Decorator usage
@with_circuit_breaker(failure_threshold=5, reset_timeout=300)
def call_ghl_api(endpoint):
    return requests.get(endpoint)
```

**States:**
- `CLOSED`: Normal operation
- `OPEN`: Too many failures, rejecting calls
- `HALF_OPEN`: Testing if service recovered

#### RetryWithBackoff - Exponential Retry
Automatic retry with exponential backoff for transient failures.

```python
from scripts.utils import RetryWithBackoff, with_retry

# Direct usage
retry = RetryWithBackoff(max_retries=3, base_delay=1.0, max_delay=60.0)
result = retry.execute(
    api.fetch_data,
    retryable_exceptions=(ConnectionError, TimeoutError)
)

# Decorator usage
@with_retry(max_retries=3, base_delay=1.0)
def fetch_with_retry():
    return api.fetch_data()
```

#### SyncLogger - Structured Logging
Sync operation logger with statistics tracking.

```python
from scripts.utils import SyncLogger

logger = SyncLogger("contacts")
logger.start_sync()

for record in records:
    try:
        if create_record(record):
            logger.record_create(record["id"])
        else:
            logger.record_update(record["id"])
    except DuplicateError:
        logger.record_skip(record["id"], "Duplicate")
    except Exception as e:
        logger.record_error(record["id"], str(e))

stats = logger.end_sync()
# {'created': 45, 'updated': 10, 'skipped': 3, 'errors': 2, 'duration_seconds': 12.5}
```

**Log File Location**: `logs/sync_{entity}_{date}.log`

### Test Coverage

**54 tests passing** covering:
- SyncState persistence and state transitions (16 tests)
- RateLimiter timing and reset (5 tests)
- CircuitBreaker state machine (10 tests)
- RetryWithBackoff exponential delays (5 tests)
- Decorator functionality (3 tests)
- SyncLogger statistics tracking (9 tests)
- Integration workflows (6 tests)

```bash
# Run tests
python3 -m pytest tests/test_infrastructure.py -v

# Output: 54 passed in 2.54s
```

### Usage Example - Complete Sync Workflow

```python
from scripts.utils import (
    SyncState, RateLimiter, CircuitBreaker, SyncLogger, RetryWithBackoff
)

# Initialize infrastructure
state = SyncState()
limiter = RateLimiter(requests_per_minute=60)
breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
retry = RetryWithBackoff(max_retries=3)
logger = SyncLogger("contacts")

logger.start_sync()

try:
    for batch in get_batches():
        limiter.wait()

        def fetch_batch():
            return ghl_api.get_contacts(batch_id=batch)

        try:
            contacts = breaker.call(retry.execute, fetch_batch)

            for contact in contacts:
                process_contact(contact, logger, state)

        except CircuitOpenError:
            logger.error("GHL API unavailable, pausing sync")
            state.record_error("contacts", "Circuit breaker open")
            break

    state.set_last_sync("contacts")

except Exception as e:
    state.record_error("contacts", str(e))

finally:
    stats = logger.end_sync()
    state.save()
```

### Directory Structure

```
someday/
├── data/
│   └── sync_state.json      # State persistence file
├── logs/
│   └── sync_contacts_20260127.log  # Daily log files
├── scripts/
│   └── utils/
│       ├── __init__.py
│       ├── deduplication.py
│       ├── sync_state.py    # NEW
│       ├── rate_limiter.py  # NEW
│       └── logging_config.py # NEW
└── tests/
    ├── test_deduplication.py
    └── test_infrastructure.py  # NEW
```

### Dependencies

- Standard library only (no additional dependencies)
- Python 3.9+ compatible

---

## 2026-01-27: Deduplication Utilities Implementation

### Objective
Create comprehensive deduplication utilities for the GHL to Baserow sync system to prevent duplicate records during data synchronization.

### Implementation Summary

**Files Created:**
- `/scripts/utils/__init__.py` - Package initialization with exports
- `/scripts/utils/deduplication.py` - Core deduplication classes and utilities
- `/tests/test_deduplication.py` - Comprehensive test suite (72 tests)

### Deduplication Strategy

#### ContactDeduplicator
Priority-based matching for contact deduplication:
1. **GHL Contact ID** (primary) - Most reliable, direct system link
2. **Email** (secondary) - Strong identifier, normalized comparison
3. **Phone** (tertiary) - Fallback for contacts without email (10+ digits required)

```python
from scripts.utils.deduplication import ContactDeduplicator, fetch_baserow_contacts

# Fetch existing contacts from Baserow
existing = fetch_baserow_contacts(api_token, table_id=817355)

# Create deduplicator with O(1) lookup indexes
dedup = ContactDeduplicator(existing)

# Check each GHL contact
for ghl_contact in ghl_contacts:
    action, existing_record = dedup.get_action(ghl_contact)
    if action == 'create':
        # Create new Baserow record
        new_record = baserow.create_row(table_id, transform(ghl_contact))
        dedup.add_to_index(ghl_contact['id'], ghl_contact['email'],
                          ghl_contact['phone'], new_record)
    elif action == 'update':
        # Update existing_record with new data
        baserow.update_row(table_id, existing_record['id'], transform(ghl_contact))
```

#### OpportunityDeduplicator
Priority-based matching for opportunity/deal deduplication:
1. **GHL Opportunity ID** (primary) - Exact match
2. **Composite Key** (secondary) - Contact ID + Deal Name

```python
from scripts.utils.deduplication import OpportunityDeduplicator, fetch_baserow_deals

existing = fetch_baserow_deals(api_token, table_id=817373)
dedup = OpportunityDeduplicator(existing)

for ghl_opp in ghl_opportunities:
    action, existing_deal = dedup.get_action(ghl_opp, contact_baserow_id=contact_id)
```

#### NewsletterDeduplicator
Subject-based deduplication for newsletter content:

```python
from scripts.utils.deduplication import NewsletterDeduplicator

existing_subjects = {"Newsletter #1", "Newsletter #2"}
dedup = NewsletterDeduplicator(existing_subjects)

if not dedup.is_duplicate("Newsletter #3"):
    create_newsletter("Newsletter #3", content)
    dedup.add("Newsletter #3")
```

### Normalization Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `normalize_email()` | Lowercase, strip whitespace | `"  JOHN@TEST.COM  "` -> `"john@test.com"` |
| `normalize_phone()` | Extract digits only | `"+1 (303) 555-1234"` -> `"13035551234"` |
| `normalize_name()` | Lowercase, collapse whitespace | `"  JOHN   DOE  "` -> `"john doe"` |

### Test Coverage

**72 tests passing** covering:
- Normalization edge cases (None, empty, unicode, whitespace)
- Contact matching priorities (GHL ID > email > phone)
- Opportunity composite key matching
- Newsletter subject deduplication
- API pagination handling
- Index maintenance during batch operations

```bash
# Run tests
python3 -m pytest tests/test_deduplication.py -v

# Output: 72 passed in 0.51s
```

### Alternative Field Name Support

The deduplicators handle multiple possible field name conventions:
- GHL Contact ID: `ghl_contact_id`, `GHL Contact ID`, `ghl_id`
- GHL Opportunity ID: `ghl_opportunity_id`, `GHL Opportunity ID`, `ghl_id`
- Email: `Email`, `email`
- Phone: `Phone`, `phone`

### Performance Characteristics

- **O(1) lookup** for all deduplication checks via hash indexes
- **Pagination support** for Baserow API fetches
- **Index maintenance** methods for batch operations without re-indexing

### Dependencies

- `requests` - HTTP client for Baserow API
- Standard library only (no additional dependencies)

---

## 2026-01-27: Add GHL ID Fields for Sync Tracking

### Objective
Add GHL ID fields to Baserow tables to enable deduplication and sync tracking between GoHighLevel and Baserow.

### Fields Required

| Table | Table ID | Field Name | Type | Purpose |
|-------|----------|------------|------|---------|
| Contacts | 817355 | `ghl_contact_id` | text | GoHighLevel Contact ID for sync tracking |
| Deals | 817373 | `ghl_opportunity_id` | text | GoHighLevel Opportunity ID for sync tracking |

### Execution Status

**API Attempt Result**: FAILED - Token Permission Error

```
Error: ERROR_NO_PERMISSION_TO_TABLE
Detail: The token does not have permissions to the table.
```

**Root Cause**: The Baserow API token (`raapY74IuN8GlZNWPzeXmFH6YnaGrafR`) has:
- READ permission on tables (verified - can list fields)
- NO CREATE FIELD permission (cannot add new columns)

### Required Manual Steps

#### Option A: Update Token Permissions (Recommended)
1. Log into Baserow at https://baserow.io
2. Navigate to Database Settings > API Tokens
3. Edit the token `raapY74IuN8GlZNWPzeXmFH6YnaGrafR`
4. Enable "Create" permission for database schema operations
5. Re-run API field creation

#### Option B: Create Fields Manually in UI
1. Log into Baserow at https://baserow.io
2. Open the GHL Integration database (ID: 360423)

**For Contacts Table (817355):**
1. Click "+" to add new field
2. Field name: `ghl_contact_id`
3. Field type: Text
4. Save

**For Deals Table (817373):**
1. Click "+" to add new field
2. Field name: `ghl_opportunity_id`
3. Field type: Text
4. Save

### Post-Creation: Update Documentation

After fields are created, obtain the new field IDs and update:
1. `/docs/COMPLETE_FIELD_MAPPING.md` - Add new field IDs to table schemas
2. Sync scripts - Use new field IDs for deduplication queries

### API Commands for After Permission Fix

Once permissions are corrected, run these commands:

```bash
# Create ghl_contact_id in Contacts table
curl -X POST "https://api.baserow.io/api/database/fields/table/817355/" \
  -H "Authorization: Token raapY74IuN8GlZNWPzeXmFH6YnaGrafR" \
  -H "Content-Type: application/json" \
  -d '{"name": "ghl_contact_id", "type": "text"}'

# Create ghl_opportunity_id in Deals table
curl -X POST "https://api.baserow.io/api/database/fields/table/817373/" \
  -H "Authorization: Token raapY74IuN8GlZNWPzeXmFH6YnaGrafR" \
  -H "Content-Type: application/json" \
  -d '{"name": "ghl_opportunity_id", "type": "text"}'
```

### Verification Commands

```bash
# Verify Contacts table fields
curl -s "https://api.baserow.io/api/database/fields/table/817355/" \
  -H "Authorization: Token raapY74IuN8GlZNWPzeXmFH6YnaGrafR" | python3 -c "import sys,json; [print(f['name'], f['id']) for f in json.load(sys.stdin)]"

# Verify Deals table fields
curl -s "https://api.baserow.io/api/database/fields/table/817373/" \
  -H "Authorization: Token raapY74IuN8GlZNWPzeXmFH6YnaGrafR" | python3 -c "import sys,json; [print(f['name'], f['id']) for f in json.load(sys.stdin)]"
```

---

## Current Table Field Inventory (2026-01-27)

### Contacts Table (817355) - 16 fields
| Field Name | Field ID | Type |
|------------|----------|------|
| Name | 7012167 | text |
| Email | 7012618 | email |
| Phone | 7012619 | phone_number |
| Company | 7012620 | text |
| Title | 7012621 | text |
| Contact Type | 7012622 | single_select |
| Status | 7012623 | single_select |
| Source | 7012624 | single_select |
| Notes | 7012625 | long_text |
| Created | 7012626 | created_on |
| Last Modified | 7012627 | last_modified |
| Buyer Profiles | 7012632 | link_row |
| Seller Profiles | 7012649 | link_row |
| Activities | 7012782 | link_row |
| Documents | 7012800 | link_row |
| Marketing Attribution | 7012813 | link_row |

**MISSING**: `ghl_contact_id` (text) - Required for sync tracking

### Deals Table (817373) - 15 fields
| Field Name | Field ID | Type |
|------------|----------|------|
| Name | 7012683 | text |
| Notes | 7012684 | long_text |
| Active | 7012685 | boolean |
| Buyer | 7012687 | link_row |
| Listing | 7012689 | link_row |
| Deal Stage | 7012691 | single_select |
| Deal Value | 7012692 | number |
| Expected Close Date | 7012693 | date |
| Actual Close Date | 7012694 | date |
| Commission Amount | 7012695 | number |
| Deal Notes | 7012696 | long_text |
| Loss Reason | 7012697 | single_select |
| Deal Terms | 7012703 | link_row |
| Activities | 7012784 | link_row |
| Documents | 7012796 | link_row |

**MISSING**: `ghl_opportunity_id` (text) - Required for sync tracking

---

## Risk Assessment

**Without GHL ID fields:**
- HIGH duplicate risk during sync operations
- Cannot efficiently query "does this GHL record exist in Baserow?"
- Current workaround stores GHL IDs in Notes field (unreliable parsing)

**With GHL ID fields:**
- Clean deduplication via `filter__field_{id}__equal={ghl_id}`
- Efficient upsert operations (create or update)
- Clear audit trail for sync provenance

---

## Next Steps

1. [ ] Fix Baserow token permissions OR create fields manually
2. [ ] Document new field IDs after creation
3. [ ] Update COMPLETE_FIELD_MAPPING.md with new field IDs
4. [ ] Update sync scripts to use new deduplication fields
5. [ ] Test sync with deduplication enabled

---

## 2026-01-27: Add "Deal Academy" Source Option to Contacts Table

### Objective
Add "Deal Academy" to the Contacts table Source field (7012624) to align with the Marketing Attribution Lead Source field and GHL tag mappings.

### Target Configuration
- **Table**: Contacts (817355)
- **Field**: Source (7012624)
- **Type**: single_select
- **Current Options**: Website, Referral, LinkedIn, Conference, Cold Outreach, Other
- **Required Addition**: Deal Academy

### Important Correction
The SYSTEM_ANALYSIS_REPORT.md incorrectly referenced field ID 7012811 as the "Source" field. Investigation reveals:
- Field 7012811 is the **"Active" boolean field** in Marketing Attribution table
- The **correct Contacts Source field** is 7012624
- The **Marketing Attribution Lead Source field** (7012820) already has "Deal Academy"

### Execution Status: BLOCKED - API Limitation

**API Attempt Result**: 401 Unauthorized

**Root Cause Analysis**:
Baserow API authentication has two token types with different capabilities:

| Token Type | Field Schema Changes | CRUD Data | Expiration |
|------------|---------------------|-----------|------------|
| Database Token | NO | YES | Permanent |
| JWT Token | YES | YES | 10-15 min |

The database token (`raapY74IuN8GlZNWPzeXmFH6YnaGrafR`) is **permanently incapable** of modifying field definitions or select options. This is a Baserow architectural limitation, not a permissions configuration issue.

**Reference**: [Baserow Authentication Documentation](https://baserow.io/blog/authenticate-baserow-using-database-json-web-token)

### Required Manual Resolution

#### Option A: Use Baserow Web UI (Recommended - 2 minutes)
1. Log into Baserow at https://baserow.io
2. Open the GHL Integration database (ID: 360423)
3. Navigate to **Contacts** table (817355)
4. Click on **Source** field header
5. Select "Edit field"
6. In Select Options, click "+ Add option"
7. Enter: `Deal Academy`
8. Save field

#### Option B: Obtain JWT Token for API Access
1. Call Baserow token_auth endpoint with admin credentials:
   ```bash
   curl -X POST "https://api.baserow.io/api/user/token-auth/" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}'
   ```
2. Extract `access_token` from response
3. Use JWT in subsequent API calls:
   ```bash
   curl -X PATCH "https://api.baserow.io/api/database/fields/7012624/" \
     -H "Authorization: JWT {access_token}" \
     -H "Content-Type: application/json" \
     -d '{
       "select_options": [
         {"id": 5147206, "value": "Website", "color": "light-blue"},
         {"id": 5147207, "value": "Referral", "color": "light-green"},
         {"id": 5147208, "value": "LinkedIn", "color": "light-cyan"},
         {"id": 5147209, "value": "Conference", "color": "light-yellow"},
         {"id": 5147210, "value": "Cold Outreach", "color": "light-red"},
         {"id": 5147211, "value": "Other", "color": "light-gray"},
         {"value": "Deal Academy", "color": "purple"}
       ]
     }'
   ```

### Post-Creation Documentation Updates

After adding "Deal Academy" option in Baserow UI:

1. **Obtain new option ID**: View field via API or note in UI
2. **Update COMPLETE_FIELD_MAPPING.md** line 132 to include new option:
   ```
   | Source | `7012624` | single_select | Website(5147206), Referral(5147207), LinkedIn(5147208), Conference(5147209), Cold Outreach(5147210), Other(5147211), Deal Academy(NEW_ID) |
   ```
3. **Update SOURCE_MAP** in field mapping section:
   ```python
   SOURCE_MAP = {
       "Website": 5147206,
       "Referral": 5147207,
       "LinkedIn": 5147208,
       "Conference": 5147209,
       "Cold Outreach": 5147210,
       "Other": 5147211,
       "Deal Academy": NEW_ID  # Add this
   }
   ```

### Verification Command (After Manual Creation)

```bash
curl -s "https://api.baserow.io/api/database/fields/table/817355/" \
  -H "Authorization: Token raapY74IuN8GlZNWPzeXmFH6YnaGrafR" | \
  python3 -c "import sys,json; f=[x for x in json.load(sys.stdin) if x['id']==7012624][0]; print('Source Options:', [(o['id'],o['value']) for o in f.get('select_options',[])])"
```

### Related GHL Tag Mappings
The following GHL tags should map to "Deal Academy" source:
- `nda purchased` (nqt5pZyDD4wNQRTwq5pa)
- `loi - purchased` (J1SpkAwD95a6I8hFt3JE)
- `deal masterclass member - sept. 2024` (FH4fuOE0z4CJyKe0pgDj)
- `deligence course` (giLUGeTczUIIoTEOfB7n)
- `purchased` (RwLuZ1BrFoelPiemDSjE)
- `starting a business 101 - purchased` (EKDY2g6pU6lvevYR95Np)
