# GoHighLevel API Reference

Complete documentation of working API endpoints and methodology for the Someday Consultants GHL instance.

## Authentication

```bash
# Base URL
https://services.leadconnectorhq.com

# Required Headers
Authorization: Bearer {GHL_API_TOKEN}
Version: 2021-07-28
Content-Type: application/json
```

**Credentials** (stored in `.env`):
- `GHL_LOCATION_ID`: oKvxmpgImkZb3TwM9ii4
- `GHL_API_TOKEN`: pit-6d7836af-f15b-450d-8231-324ebccbd60a (Private Integration Token)

---

## Working Endpoints

### Contacts

**List Contacts**
```bash
GET /contacts/?locationId={locationId}&limit={limit}

# Pagination
GET /contacts/?locationId={locationId}&limit=100&startAfter={timestamp}&startAfterId={id}

# Query search
GET /contacts/?locationId={locationId}&query={search_term}
```

**Response**: Returns contacts with `id`, `firstName`, `lastName`, `email`, `phone`, `companyName`, `tags[]`, `customFields[]`, `attributions[]`, `dateAdded`, `dateUpdated`

**Get Single Contact**
```bash
GET /contacts/{contactId}
```

---

### Pipelines & Opportunities

**List Pipelines**
```bash
GET /opportunities/pipelines?locationId={locationId}
```

**Response**: Returns pipelines with stages
```json
{
  "pipelines": [
    {
      "id": "bZP2ihvK0wk0NaERm2TA",
      "name": "Buyer",
      "stages": [
        {"id": "...", "name": "Lead"},
        {"id": "...", "name": "Engaged Buyer"}
      ]
    }
  ]
}
```

**Search Opportunities**
```bash
POST /opportunities/search
Body: {
  "locationId": "{locationId}",
  "pipelineId": "{pipelineId}",  // optional
  "limit": 50
}
```

---

### Tags

**List Tags**
```bash
GET /locations/{locationId}/tags
```

**Response**:
```json
{
  "tags": [
    {"id": "XVO1pLP8953flzc9jsaN", "name": "potential buyer"},
    {"id": "MhpR5LyhyA5gMX0Tf0wf", "name": "general newsletter"}
  ]
}
```

---

### Custom Fields

**Contact Custom Fields**
```bash
GET /locations/{locationId}/customFields?model=contact
```

**Opportunity Custom Fields**
```bash
GET /locations/{locationId}/customFields?model=opportunity
```

---

### Workflows

**List Workflows**
```bash
GET /workflows?locationId={locationId}
```

**Response**:
```json
{
  "workflows": [
    {
      "id": "uuid",
      "name": "Workflow Name",
      "status": "published|draft",
      "version": 10,
      "createdAt": "2024-03-20T23:01:30.708Z",
      "updatedAt": "2024-05-02T14:55:32.016Z"
    }
  ]
}
```

---

### Campaigns (Automation Sequences)

**List Campaigns**
```bash
GET /campaigns/?locationId={locationId}
```

**Note**: These are automation/drip campaigns, NOT email marketing campaigns.

---

### Forms

**List Forms**
```bash
GET /forms?locationId={locationId}
```

**Get Form Submissions**
```bash
GET /forms/submissions?locationId={locationId}&limit={limit}

# Filter by form
GET /forms/submissions?locationId={locationId}&formId={formId}&limit={limit}
```

**Response includes**:
- Contact info (name, email, phone)
- Form field responses in `others` object
- Event data with traffic source, referrer, page URL
- Funnel data with funnel_id, page_id

---

### Conversations & Messages (⭐ Key for Newsletter Content)

**Search Conversations**
```bash
GET /conversations/search?locationId={locationId}&limit={limit}
```

**Response**:
```json
{
  "conversations": [
    {
      "id": "conversationId",
      "contactId": "...",
      "fullName": "Contact Name",
      "email": "...",
      "lastMessageType": "TYPE_CAMPAIGN_EMAIL|TYPE_EMAIL|TYPE_SMS",
      "lastMessageBody": "Preview text...",
      "lastMessageDate": 1769528093477
    }
  ],
  "total": 2453
}
```

**Get Conversation Messages**
```bash
GET /conversations/{conversationId}/messages?limit={limit}
```

**Get Single Message (Full Content)**
```bash
GET /conversations/messages/{messageId}
```

**Response**: Full HTML email content in `body` field, plus:
- `meta.email.subject`: Email subject line
- `meta.email.direction`: inbound|outbound
- `source`: "campaign" for email campaigns

---

### Location Info

**Get Location Details**
```bash
GET /locations/{locationId}
```

**Response**: Business name, address, contact info, settings, permissions

---

### Templates

**List Templates**
```bash
GET /locations/{locationId}/templates
```

**Note**: Returns `{"templates":[],"totalCount":0}` if none created

---

## Endpoints with Limited Access (401 IAM Errors)

These require different IAM scopes not available via Private Integration Token:

- `GET /funnels` - Funnel details
- `GET /websites` - Website builder content
- `GET /emails/campaigns` - Email marketing campaigns list
- `GET /campaigns/{id}` - Campaign details
- `GET /forms/{formId}` - Form details
- `GET /locations/{id}/templates/email` - Email templates

---

## Data Extraction Methodology

### 1. Newsletter/Email Campaign Content

**Problem**: No direct API endpoint for email marketing campaigns

**Solution**: Use conversations API to extract sent newsletters

```bash
# Step 1: Search conversations with campaign emails
GET /conversations/search?locationId={locationId}&limit=50

# Step 2: Find conversations with lastMessageType = "TYPE_CAMPAIGN_EMAIL"

# Step 3: Get messages from that conversation
GET /conversations/{conversationId}/messages?limit=100

# Step 4: Get full message content
GET /conversations/messages/{messageId}
# Look for source = "campaign" and meta.email.direction = "outbound"
```

### 2. Traffic Sources & Attribution

```bash
# From form submissions
GET /forms/submissions?locationId={locationId}&limit=50

# Extract from each submission:
submission.others.eventData.source      # "Social media", "Direct traffic", etc.
submission.others.eventData.referrer    # "https://www.youtube.com", etc.
submission.others.eventData.page.url    # Landing page URL
submission.others.funneEventData.funnel_id  # Funnel identifier
```

### 3. Contact Import for Baserow Sync

```bash
# Paginated contact export
GET /contacts/?locationId={locationId}&limit=100

# Then use pagination:
GET /contacts/?locationId={locationId}&limit=100&startAfter={timestamp}&startAfterId={id}
```

---

## Key Data Points Found

### Location
- **Company**: Someday Consultants
- **Address**: 1616 17th Street, Denver, CO 80202
- **Contact**: Sara Sharp (sharp@skandslegal.com)
- **Phone**: +1 303-396-0247

### Contacts
- **Total**: 2,487 contacts
- **With newsletter tag**: ~1,892 (76%)
- **Primary source**: Zapier imports (64%)

### Pipelines
| Pipeline | Stages |
|----------|--------|
| Buyer | Lead → Engaged Buyer → Seller Outreach & NDA → LOI Submitted → Due Diligence → Financing → Closing |
| Seller | Lead → Engaged Seller → Buyer Outreach & NDA → LOI Stage → Collecting DD → Deal Finalization → Closing |
| Free Consult Call | New Leads → Hot Leads → Booking Requested → Booking Confirmed → Service(s) Sold |
| Consulting Engagement | Won/Send Contract |

### Tags (16 total)
| Tag | ID | Count/Usage |
|-----|-----|-------------|
| general newsletter | MhpR5LyhyA5gMX0Tf0wf | ~1,892 |
| potential buyer | XVO1pLP8953flzc9jsaN | Buyer contacts |
| lead | 5FGJwgkrM7Imaq7rFVse | Lead status |
| affiliate | xCHW6wEkOB0w3n9tEvbz | Advisor contacts |

### Workflows (21)
- 17 published, 4 draft
- Key: "General Newsletter Subscribers", Buyer stage workflows, Membership courses

### Forms (10)
- Newsletter: "2025 - Subscribe to newsletter"
- Lead magnets: "LOI FREE ACCESS", "LOI QUESTIONNAIRE REQUEST"
- Webinar: "September 2024 Webinar Registration"

### Funnels (from submissions)
| Funnel ID | Pages |
|-----------|-------|
| I51Ljx9n... | `/`, `/home` (Become the Expert) |
| 25YR6ZwL... | `/newsletter`, `/loi`, `/call-confirmation` |

### Newsletter History
Weekly sends on Mondays at ~8:30 AM MT. Recent subjects:
- 2026-01-27: "The Compliance Mistake That Could Tank Your Deal"
- 2026-01-20: "Purchase Agreements: Your (Not-So-Boring) Deal Survival Guide"
- 2026-01-13: "Want to Make a Seller Hate You? Put This in Your LOI"
- 2026-01-06: "Think Your Non-Compete Doesn't Matter? Think Again"
- (Full list: 25+ newsletters since Aug 2025)

---

## Python Examples

### Fetch All Contacts
```python
import requests

BASE_URL = "https://services.leadconnectorhq.com"
HEADERS = {
    "Authorization": f"Bearer {GHL_API_TOKEN}",
    "Version": "2021-07-28",
    "Content-Type": "application/json"
}

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

### Extract Newsletter Subjects
```python
def get_newsletter_subjects(location_id):
    # Get conversations with campaign emails
    url = f"{BASE_URL}/conversations/search?locationId={location_id}&limit=50"
    response = requests.get(url, headers=HEADERS)
    data = response.json()

    # Find a conversation with campaign emails
    for conv in data['conversations']:
        if conv.get('lastMessageType') == 'TYPE_CAMPAIGN_EMAIL':
            conv_id = conv['id']
            break

    # Get messages from that conversation
    url = f"{BASE_URL}/conversations/{conv_id}/messages?limit=100"
    response = requests.get(url, headers=HEADERS)
    messages = response.json()['messages']['messages']

    # Extract subjects from campaign messages
    newsletters = {}
    for msg in messages:
        if msg.get('source') == 'campaign':
            subject = msg.get('meta', {}).get('email', {}).get('subject', '')
            date = msg.get('dateAdded', '')[:10]
            if subject and subject not in newsletters:
                newsletters[subject] = date

    return newsletters
```

---

## Rate Limits & Best Practices

1. **Pagination**: Always use pagination for contacts (max 100 per request)
2. **Rate Limiting**: No documented limits, but use reasonable delays between bulk operations
3. **Token Security**: Private Integration Tokens have location-level access only
4. **Error Handling**: Check for 401 (IAM not supported), 403 (forbidden), 404 (not found)

---

## Related Documentation

- [GHL_BASEROW_MAPPING.md](./GHL_BASEROW_MAPPING.md) - Field mappings for Baserow sync
- [DATA_CENTRALIZATION_MASTER_PLAN.md](./DATA_CENTRALIZATION_MASTER_PLAN.md) - Overall CRM strategy
