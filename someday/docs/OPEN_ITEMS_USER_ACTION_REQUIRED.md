# Open Items - User Action Required

**Document:** Data Centralization Project
**Created:** 2026-01-26
**Status:** Awaiting User Input

---

## Summary

The following 3 data sources are **blocked** and cannot proceed without user action. All other sources (YouTube, Blog, Podcast, Media) can be extracted without additional input.

---

## Open Item 1: LinkedIn Data Export

**Source:** LinkedIn Posts + Articles
**Status:** PARTIALLY RESOLVED
**Priority:** Medium
**Estimated Content:** 11 articles (~12,000 words) RECEIVED + 100+ posts (~15,000 words) STILL MISSING

### What Was Received (2026-03-03)

Basic LinkedIn export (`Basic_LinkedInDataExport_02-24-2026.zip`) contained:
- **11 LinkedIn Articles** (HTML) — M&A thought leadership content → `data/raw/linkedin/articles/`
- **Profile data** (bio, headline, summary) → `data/raw/linkedin/profile/Profile.csv`
- **15 career positions** → `data/raw/linkedin/profile/Positions.csv`
- **23 skills** → `data/raw/linkedin/profile/Skills.csv`
- **Education history** → `data/raw/linkedin/profile/Education.csv`
- **Honors/Awards** (SuperLawyers, BestLawyers, CALI) → `data/raw/linkedin/profile/Honors.csv`
- **4 recommendations** → `data/raw/linkedin/profile/Recommendations_Received.csv`
- Original zip archived at `data/raw/linkedin/exports/`

**NOT included** (privacy — intentionally excluded):
- `messages.csv` (5.5MB private messages)
- `Connections.csv` (contact list)
- Ad targeting, invitations, etc.

### Still Blocked: Posts/Shares CSV

The "Basic" export does **not** include LinkedIn posts (short-form feed content). To get posts:

1. Log into LinkedIn at `linkedin.com`
2. Go to **Settings & Privacy** → **Data Privacy** → **Get a copy of your data**
3. Click **Request archive**
4. **Specifically select "Posts"** (the Basic export doesn't include these)
5. Submit request and wait for email (24-72 hours)
6. Download the new ZIP and provide file path

### Next Steps (no user action needed)

1. Extract articles HTML → normalized documents (need article extractor or extend linkedin_extractor.py)
2. Build profile context document from Profile.csv + Positions.csv + Skills.csv
3. Run normalization → chunking → embedding pipeline for articles
4. When Posts CSV arrives, run existing `linkedin_extractor.py`

### Notes
- LinkedIn limits data exports to once every 24 hours
- Articles are high-value long-form M&A content (~1,000-1,200 words each)
- Posts extractor (`scripts/extract/linkedin_extractor.py`) is ready for Posts CSV when available

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
| 1a | LinkedIn Articles | RECEIVED | Extract received | 2026-03-03 |
| 1b | LinkedIn Posts | BLOCKED | Re-export selecting "Posts" | Pending |
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
| 1a | LinkedIn Articles | RECEIVED | Extract received | 2026-03-03 |
| 1b | LinkedIn Posts | BLOCKED | Re-export selecting "Posts" | Pending |
| 2 | Book PDF | BLOCKED | Provide file | Pending |
| 3 | Deal Academy | BLOCKED | Provide credentials | Pending |
| 4 | Baserow Schema | BLOCKED | Add fields in UI | Pending |

---

*This document is referenced by DATA_CENTRALIZATION_MASTER_PLAN.md*
