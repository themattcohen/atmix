# Open Items - User Action Required

**Document:** Data Centralization Project
**Created:** 2026-01-26
**Status:** Awaiting User Input

---

## Summary

The following 3 data sources are **blocked** and cannot proceed without user action. All other sources (YouTube, Blog, Podcast, Media) can be extracted without additional input.

---

## Open Item 1: LinkedIn Data Export

**Source:** LinkedIn Posts
**Status:** BLOCKED
**Priority:** Medium
**Estimated Content:** 100+ posts (~15,000 words)

### Action Required

1. Log into LinkedIn at `linkedin.com`
2. Go to **Settings & Privacy** → **Data Privacy** → **Get a copy of your data**
3. Click **Request archive**
4. Select **"Posts"** (and optionally "Articles")
5. Submit request
6. Wait for email notification (typically 24-72 hours)
7. Download the ZIP file
8. Extract and locate the CSV file containing posts

### Once Complete

Notify me with the file path, then run:
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --linkedin /path/to/linkedin_posts.csv
```

### Notes
- LinkedIn limits data exports to once every 24 hours
- Export contains post text, dates, and engagement metrics
- No API access required

---

## Open Item 2: Book PDF File

**Source:** Sara Sharp's Book(s)
**Status:** BLOCKED
**Priority:** Medium
**Estimated Content:** 40,000-60,000 words per book

### Action Required

1. Locate the PDF file(s) of Sara Sharp's book(s)
2. Provide the file path or upload location

### Once Complete

Place PDF in the designated directory and run:
```bash
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --book /Users/matt/Documents/someday/data/raw/book/pdf/BOOK_NAME.pdf
```

### Notes
- Script supports chapter detection via regex patterns
- Scanned PDFs may require OCR preprocessing
- Multiple books can be processed sequentially

---

## Open Item 3: Deal Academy Credentials

**Source:** Deal Academy (Teachable Platform)
**Status:** BLOCKED
**Priority:** Medium
**Estimated Content:** 40,000+ words across courses

### Action Required

Provide Teachable login credentials:
- **Email:** [your Teachable account email]
- **Password:** [your Teachable account password]

### Security Note
Credentials will be used via environment variables, not stored in code:
```bash
export TEACHABLE_EMAIL="your@email.com"
export TEACHABLE_PASSWORD="yourpassword"
```

### Once Complete

Run:
```bash
export TEACHABLE_EMAIL="your@email.com"
export TEACHABLE_PASSWORD="yourpassword"
python /Users/matt/Documents/someday/docs/sara_content_extractor.py --deal-academy
```

### Notes
- Script will authenticate and extract enrolled course content
- Video lessons may require additional Whisper transcription
- Content used for personal RAG knowledge base only

---

## Tracking

| Item | Source | Status | User Action | Date Resolved |
|------|--------|--------|-------------|---------------|
| 1 | LinkedIn | BLOCKED | Export data | Pending |
| 2 | Book PDF | BLOCKED | Provide file | Pending |
| 3 | Deal Academy | BLOCKED | Provide credentials | Pending |

---

## What Can Proceed Now

The following sources have **no blockers** and can be extracted immediately:

| Source | Status | Command |
|--------|--------|---------|
| YouTube | Ready | `python sara_content_extractor.py --youtube` |
| Blog | Ready | `python sara_content_extractor.py --blog` |
| Podcast | Ready | `python sara_content_extractor.py --podcast` |
| Media | Ready | Manual URL collection + scraping |

---

## How to Update This Document

When you complete an action item:
1. Notify Claude with the relevant file path or credentials
2. This document will be updated to mark the item as RESOLVED
3. Extraction will proceed for that source

---

## Open Item 4: Baserow Schema Updates

**Source:** Baserow API
**Status:** BLOCKED
**Priority:** High (Required before GHL sync)
**Reason:** Database tokens cannot modify field schemas (requires JWT authentication)

### Action Required

Log into Baserow UI and add the following field configurations:

#### 4a. Add "Deal Academy" Source Option to Contacts Table

1. Log into Baserow at https://baserow.io
2. Open the GHL Integration database (ID: 360423)
3. Navigate to **Contacts** table
4. Click on **Source** field header → "Edit field"
5. Click "+ Add option"
6. Enter: `Deal Academy`
7. Save field

#### 4b. Add GHL ID Fields (From Previous Log Entry)

**Contacts Table:**
1. Click "+" to add new field
2. Field name: `ghl_contact_id`
3. Field type: Text
4. Save

**Deals Table:**
1. Click "+" to add new field
2. Field name: `ghl_opportunity_id`
3. Field type: Text
4. Save

### Once Complete

Provide the new field/option IDs so documentation can be updated:
- Deal Academy option ID: ______
- ghl_contact_id field ID: ______
- ghl_opportunity_id field ID: ______

### Why Manual?

Baserow uses two authentication types:
- **Database tokens** (what we have): Can only CRUD row data
- **JWT tokens** (requires login): Can modify schema/fields

Our database token is permanently incapable of schema changes - this is by Baserow design for security.

### Notes
- Estimated time: 5 minutes
- See `/docs/IMPLEMENTATION_LOG.md` for full technical details

---

## Tracking

| Item | Source | Status | User Action | Date Resolved |
|------|--------|--------|-------------|---------------|
| 1 | LinkedIn | BLOCKED | Export data | Pending |
| 2 | Book PDF | BLOCKED | Provide file | Pending |
| 3 | Deal Academy | BLOCKED | Provide credentials | Pending |
| 4 | Baserow Schema | BLOCKED | Add fields in UI | Pending |

---

*This document is referenced by DATA_CENTRALIZATION_MASTER_PLAN.md*
