# GHL Data Extraction System Design

## Overview

This document describes the architecture and implementation for extracting data from GoHighLevel (GHL) for use in the Someday CRM system, including RAG ingestion and Baserow synchronization.

## Data Sources Available

| Data Type | API Endpoint | Status | RAG Ingest | Baserow Sync |
|-----------|--------------|--------|------------|--------------|
| Contacts | `/contacts/` | ✅ Working | No | Yes |
| Newsletters | `/conversations/messages/{id}` | ✅ Working | Yes | No |
| Opportunities | `/opportunities/search` | ✅ Working | No | Yes |
| Pipelines | `/opportunities/pipelines` | ✅ Working | No | Reference |
| Tags | `/locations/{id}/tags` | ✅ Working | No | Reference |
| Custom Fields | `/locations/{id}/customFields` | ✅ Working | No | Reference |
| Workflows | `/workflows` | ✅ Working | No | No |
| Forms | `/forms` | ✅ Working | No | No |
| Form Submissions | `/forms/submissions` | ✅ Working | No | Yes |
| Funnels | `/funnels` | ❌ 401 IAM | N/A | N/A |
| Websites | `/websites` | ❌ 401 IAM | N/A | N/A |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GHL API                                  │
│  https://services.leadconnectorhq.com                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Extraction Layer                         │
│  scripts/ghl_extractor.py                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  Contacts   │ │ Newsletters │ │Opportunities│                │
│  │  Extractor  │ │  Extractor  │ │  Extractor  │                │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                │
└─────────┼───────────────┼───────────────┼───────────────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Raw Data Storage                            │
│  data/raw/                                                       │
│  ├── ghl_contacts/     # Contact JSON exports                    │
│  ├── newsletter/       # Newsletter HTML + metadata              │
│  └── ghl_opportunities/# Opportunity data                        │
└─────────────────────────────────────────────────────────────────┘
          │                               │
          ▼                               ▼
┌──────────────────────┐    ┌─────────────────────────────────────┐
│   RAG Pipeline       │    │       Baserow Sync                  │
│   (Newsletters)      │    │       (Contacts, Opps)              │
│                      │    │                                     │
│ data/normalized/     │    │ scripts/baserow_sync.py             │
│ data/rag/chunks/     │    │ → Baserow API                       │
│ data/rag/embeddings/ │    │                                     │
│ data/rag/indexes/    │    │                                     │
└──────────────────────┘    └─────────────────────────────────────┘
```

---

## 1. Newsletter Extraction (RAG)

### Purpose
Extract Sara Sharp's weekly newsletters for RAG-based knowledge retrieval.

### API Flow
```
1. GET /conversations/search?locationId={id}&limit=100
   → Find conversations with TYPE_CAMPAIGN_EMAIL

2. GET /conversations/{conversationId}/messages?limit=100
   → List all messages, filter for source="campaign"

3. GET /conversations/messages/{messageId}
   → Get full HTML content of each newsletter
```

### Data Schema (Raw)
```json
{
  "id": "gR5742huoSBPM7sftLVf",
  "source": "ghl_newsletter",
  "source_type": "newsletter",
  "title": "The Compliance Mistake That Could Tank Your Deal",
  "date": "2026-01-27T15:32:17.613Z",
  "content": {
    "text": "Plain text version...",
    "html": "<div>HTML version...</div>"
  },
  "metadata": {
    "message_id": "gR5742huoSBPM7sftLVf",
    "sent_date": "2026-01-27T15:32:17.613Z",
    "subject": "The Compliance Mistake...",
    "author": "Sara Sharp",
    "word_count": 450
  }
}
```

### Normalized Schema (for RAG)
```json
{
  "id": "newsletter_abc123def456",
  "source": "ghl_newsletter",
  "source_type": "newsletter",
  "title": "The Compliance Mistake...",
  "content": {
    "text": "Plain text...",
    "summary": null,
    "key_topics": []
  },
  "metadata": {
    "url": null,
    "author": "Sara Sharp",
    "word_count": 450,
    "language": "en",
    "published_date": "2026-01-27",
    "ghl_message_id": "gR5742huoSBPM7sftLVf"
  }
}
```

### Deduplication Strategy

**Problem**: Same newsletter sent to thousands of contacts creates duplicate messages in conversations.

**Solution**: Deduplicate by subject line (unique per send) and track by GHL message ID.

```python
# Deduplication during extraction
seen_subjects = set()
for msg in all_messages:
    subject = msg.get('meta', {}).get('email', {}).get('subject', '')
    if subject and subject not in seen_subjects:
        seen_subjects.add(subject)
        # Process unique newsletter
```

**Incremental extraction**: Check existing documents before re-extracting:
```python
existing_docs = {}
for f in os.listdir(NORM_DIR):
    if f.startswith('newsletter_'):
        doc = json.load(open(f))
        ghl_id = doc.get('metadata', {}).get('ghl_message_id')
        if ghl_id:
            existing_docs[ghl_id] = f

# Skip already extracted
if msg_id in existing_docs:
    continue
```

### Implementation
```python
# scripts/ghl_newsletter_extractor.py

import requests
import json
import re
from html import unescape
from datetime import datetime
import hashlib

class GHLNewsletterExtractor:
    def __init__(self, api_token, location_id):
        self.base_url = "https://services.leadconnectorhq.com"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Version": "2021-07-28",
            "Content-Type": "application/json"
        }
        self.location_id = location_id

    def find_newsletter_conversation(self):
        """Find conversation containing newsletter campaigns"""
        url = f"{self.base_url}/conversations/search"
        params = {"locationId": self.location_id, "limit": 100}
        response = requests.get(url, headers=self.headers, params=params)
        data = response.json()

        # Find Sara Sharp's conversation (contains all newsletters)
        for conv in data.get('conversations', []):
            if conv.get('email') == 'sharp@dealacademy.org':
                return conv['id']

        # Fallback: any conversation with campaign emails
        for conv in data.get('conversations', []):
            if conv.get('lastMessageType') == 'TYPE_CAMPAIGN_EMAIL':
                return conv['id']

        return None

    def get_newsletter_messages(self, conversation_id):
        """Get all newsletter message IDs from conversation"""
        url = f"{self.base_url}/conversations/{conversation_id}/messages"
        params = {"limit": 100}
        response = requests.get(url, headers=self.headers, params=params)
        data = response.json()

        messages = data.get('messages', {}).get('messages', [])
        return [
            {
                'id': msg['id'],
                'subject': msg.get('meta', {}).get('email', {}).get('subject', ''),
                'date': msg.get('dateAdded', '')
            }
            for msg in messages
            if msg.get('source') == 'campaign'
        ]

    def get_full_message(self, message_id):
        """Get full message content including HTML body"""
        url = f"{self.base_url}/conversations/messages/{message_id}"
        response = requests.get(url, headers=self.headers)
        return response.json().get('message', {})

    def strip_html(self, html):
        """Convert HTML to plain text"""
        text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</(p|div|tr|li|h[1-6])>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)
        text = unescape(text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        return text.strip()

    def extract_all(self, output_dir):
        """Extract all newsletters to output directory"""
        conv_id = self.find_newsletter_conversation()
        if not conv_id:
            raise Exception("No newsletter conversation found")

        messages = self.get_newsletter_messages(conv_id)

        extracted = []
        for msg in messages:
            full_msg = self.get_full_message(msg['id'])
            html_body = full_msg.get('body', '')
            plain_text = self.strip_html(html_body)

            doc_id = f"newsletter_{hashlib.md5(msg['id'].encode()).hexdigest()[:12]}"

            newsletter = {
                "id": doc_id,
                "source": "ghl_newsletter",
                "source_type": "newsletter",
                "title": msg['subject'],
                "content": {
                    "text": plain_text,
                    "summary": None,
                    "key_topics": []
                },
                "metadata": {
                    "author": "Sara Sharp",
                    "word_count": len(plain_text.split()),
                    "language": "en",
                    "published_date": msg['date'][:10],
                    "ghl_message_id": msg['id']
                },
                "extraction": {
                    "extracted_at": datetime.now().isoformat(),
                    "extractor_version": "1.0.0",
                    "quality_score": 0.9
                }
            }

            # Save to normalized documents
            filepath = f"{output_dir}/{doc_id}.json"
            with open(filepath, 'w') as f:
                json.dump(newsletter, f, indent=2)

            extracted.append(newsletter)

        return extracted
```

---

## 2. Contact Extraction (Baserow Sync)

### Purpose
Extract contacts for synchronization to Baserow CRM.

### API Flow
```
1. GET /contacts/?locationId={id}&limit=100
   → Paginate through all contacts

2. For each contact, extract:
   - Basic info (name, email, phone, company)
   - Tags (for contact type classification)
   - Custom fields (profession, etc.)
   - Attribution data (UTM source, medium)
```

### Pagination Pattern
```python
def fetch_all_contacts(location_id):
    contacts = []
    url = f"{BASE_URL}/contacts/?locationId={location_id}&limit=100"

    while url:
        response = requests.get(url, headers=HEADERS)
        data = response.json()
        contacts.extend(data.get('contacts', []))
        url = data.get('meta', {}).get('nextPageUrl')

    return contacts
```

### Field Mapping (GHL → Baserow)

| GHL Field | Baserow Field | Transform |
|-----------|---------------|-----------|
| `firstName` + `lastName` | Name | Concatenate |
| `email` | Email | Direct |
| `phone` | Phone | Direct |
| `companyName` | Company | Direct |
| `customFields[Profession]` | Title | Field ID lookup |
| `tags[]` | Contact Type | Logic (see mapping doc) |
| `type` | Status | lead→Active, customer→Customer |
| `attributions[].utmSessionSource` | Source | Map to select |

### Contact Type Classification
```python
def classify_contact_type(contact, pipelines):
    tags = [t.lower() for t in contact.get('tags', [])]

    if 'potential buyer' in tags:
        return 'Buyer'
    elif 'affiliate' in tags:
        return 'Advisor'
    elif contact_in_pipeline(contact, 'Seller', pipelines):
        return 'Seller'
    elif contact_in_pipeline(contact, 'Buyer', pipelines):
        return 'Buyer'
    else:
        return 'Other'
```

---

## 3. Opportunity Extraction (Baserow Sync)

### Purpose
Extract opportunities/deals for Baserow Deals table.

### API Flow
```
POST /opportunities/search
Body: {
  "locationId": "{locationId}",
  "limit": 100
}
```

### Stage Mapping

**Buyer Pipeline → Baserow Deal Stage:**
| GHL Stage | Baserow Stage |
|-----------|---------------|
| Lead | Initial Interest |
| Engaged Buyer | Initial Interest |
| Seller Outreach & NDA | NDA Signed |
| LOI Submitted | LOI Submitted |
| Due Diligence | Due Diligence |
| Financing & Bank Process | Under Contract |
| Closing | Under Contract |
| (status=won) | Closed Won |
| (status=lost) | Closed Lost |

---

## 4. Form Submission Extraction

### Purpose
Track lead sources and attribution data.

### API Flow
```
GET /forms/submissions?locationId={id}&limit=50
```

### Attribution Data Available
```json
{
  "eventData": {
    "source": "Social media",
    "referrer": "https://www.youtube.com",
    "page": {
      "url": "https://dealacademy.org/"
    }
  },
  "funneEventData": {
    "funnel_id": "I51Ljx9n...",
    "page_url": "/"
  }
}
```

---

## 5. Scheduled Extraction Jobs

### Recommended Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Newsletter Extract | Weekly (Tue) | Ingest new newsletter after Mon send |
| Contact Sync | Daily | Keep Baserow contacts current |
| Opportunity Sync | Hourly | Track deal stage changes |
| Form Submissions | Daily | Marketing attribution updates |

### Cron Configuration
```bash
# Newsletter extraction (Tuesday 6am)
0 6 * * 2 python scripts/ghl_newsletter_extractor.py

# Contact sync (daily 2am)
0 2 * * * python scripts/ghl_contact_sync.py

# Opportunity sync (hourly)
0 * * * * python scripts/ghl_opportunity_sync.py
```

---

## 6. Error Handling

### Common API Errors

| Code | Meaning | Action |
|------|---------|--------|
| 401 | IAM not supported | Endpoint unavailable, use workaround |
| 403 | Forbidden | Check token permissions |
| 404 | Not found | Check endpoint path |
| 429 | Rate limited | Exponential backoff |

### Retry Strategy
```python
import time

def api_call_with_retry(url, headers, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)

        if response.status_code == 429:
            wait_time = 2 ** attempt
            time.sleep(wait_time)
            continue

        if response.status_code == 200:
            return response.json()

        response.raise_for_status()

    raise Exception(f"Failed after {max_retries} attempts")
```

---

## 7. Environment Configuration

### Required Environment Variables
```bash
# .env
GHL_LOCATION_ID=oKvxmpgImkZb3TwM9ii4
GHL_API_TOKEN=pit-6d7836af-f15b-450d-8231-324ebccbd60a
BASEROW_API_TOKEN=raapY74IuN8GlZNWPzeXmFH6YnaGrafR
```

### API Headers
```python
HEADERS = {
    "Authorization": f"Bearer {os.getenv('GHL_API_TOKEN')}",
    "Version": "2021-07-28",
    "Content-Type": "application/json"
}
```

---

## 8. Duplicate Detection & Handling

### Newsletter Deduplication

**Challenge**: Each newsletter is sent to ~1,900 contacts, creating duplicate messages in conversations.

**Strategy**:
1. **Subject-based deduplication**: Same subject = same newsletter
2. **Message ID tracking**: Store GHL message ID in metadata
3. **Incremental extraction**: Check existing docs before re-extracting

```python
class NewsletterDeduplicator:
    def __init__(self, norm_dir):
        self.existing = self._load_existing(norm_dir)
        self.seen_subjects = set()

    def _load_existing(self, norm_dir):
        """Load existing newsletter GHL IDs"""
        existing = {}
        for f in os.listdir(norm_dir):
            if f.startswith('newsletter_'):
                doc = json.load(open(os.path.join(norm_dir, f)))
                ghl_id = doc.get('metadata', {}).get('ghl_message_id')
                if ghl_id:
                    existing[ghl_id] = f
        return existing

    def is_duplicate(self, message):
        """Check if message is duplicate"""
        msg_id = message['id']
        subject = message.get('meta', {}).get('email', {}).get('subject', '')

        # Already extracted
        if msg_id in self.existing:
            return True

        # Same subject already processed this session
        if subject in self.seen_subjects:
            return True

        self.seen_subjects.add(subject)
        return False
```

### Contact Deduplication (for Baserow sync)

**GHL Settings**: Configured to dedupe on email OR phone
```json
{"contactUniqueIdentifiers": ["phone", "email"]}
```

**Baserow Strategy**:
1. Query existing contacts by email before insert
2. Use Baserow's unique constraint on Email field
3. Merge/update on conflict rather than insert

### Opportunity Deduplication

**Strategy**: Use GHL opportunity ID as unique key
- Store `ghl_opportunity_id` in Baserow Deal metadata
- Query by ID before insert
- Update existing on match

---

## 9. Data Quality Checks

### Contact Validation
- Email format validation
- Phone number normalization
- Duplicate detection (by email/phone)

### Newsletter Validation
- Minimum word count (100+ words)
- HTML parsing success
- Date format validation

### Opportunity Validation
- Valid pipeline/stage IDs
- Monetary value format
- Contact ID exists

---

## Related Documentation

- [GHL_API_REFERENCE.md](./GHL_API_REFERENCE.md) - Complete API endpoint reference
- [GHL_BASEROW_MAPPING.md](./GHL_BASEROW_MAPPING.md) - Field mapping specifications
- [RAG_SYSTEM_DESIGN.md](./RAG_SYSTEM_DESIGN.md) - RAG pipeline architecture
- [DATA_CENTRALIZATION_MASTER_PLAN.md](./DATA_CENTRALIZATION_MASTER_PLAN.md) - Overall CRM strategy
