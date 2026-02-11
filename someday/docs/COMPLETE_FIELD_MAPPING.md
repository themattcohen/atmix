# Complete GHL ↔ Baserow Field Mapping

> Generated: 2026-01-27
> This document contains **complete field IDs** for both systems to enable automated sync scripts.

---

## System Configuration

### GHL Configuration
```
Location ID: oKvxmpgImkZb3TwM9ii4
API Base: https://services.leadconnectorhq.com
API Version: 2021-07-28
Token Env Var: GHL_API_TOKEN
```

### Baserow Configuration
```
Database ID: 360423
Workspace ID: 173396
API Base: https://api.baserow.io/api
Token Env Var: BASEROW_API_TOKEN
```

### Baserow Table IDs (Quick Reference)

| Table | Table ID | Primary Field ID |
|-------|----------|------------------|
| Contacts | 817355 | 7012167 |
| Buyer Profiles | 817366 | 7012628 |
| Seller Profiles | 817368 | 7012645 |
| Listings | 817371 | 7012668 |
| Deals | 817373 | 7012683 |
| Deal Terms | 817374 | 7012698 |
| Activities | 817377 | 7012730 |
| Documents | 817382 | 7012792 |
| Marketing Attribution | 817383 | 7012809 |

---

## GHL Reference Data

### Pipelines

| Pipeline | ID | Use Case |
|----------|-----|----------|
| **Buyer** | `bZP2ihvK0wk0NaERm2TA` | Track buyer journey |
| **Seller** | `u0xJpO4msaNpBqvd1anz` | Track seller journey |
| Free Consult Call | `CvVxDxxvx0TSOIgJWJpR` | Sales pipeline |
| Consulting Engagement | `dRorUtGFyRjqwQMbLKji` | Service delivery |

### Buyer Pipeline Stages

| Stage | ID | Position | Baserow Deal Stage |
|-------|-----|----------|-------------------|
| Lead | `e5b69b66-705e-49e7-a0bf-e2b7a86197a5` | 0 | Initial Interest |
| Engaged Buyer | `a8910d32-4bc2-45ad-9c90-b5186aae2c0c` | 1 | Initial Interest |
| Seller Outreach & NDA Execution | `742e5ebb-2113-4792-a2eb-41aa7c2e56b7` | 2 | NDA Signed |
| LOI Submitted | `07ec4c25-895a-402c-9e75-cfbbc16f53c5` | 3 | LOI Submitted |
| Due Diligence | `4484b292-7faa-4761-a9b2-ad59fd887cc7` | 4 | Due Diligence |
| Financing & Bank Process | `a73baee5-9f40-44c6-a898-f5a9aa1d3d49` | 5 | Under Contract |
| Closing | `3a74ecfc-082e-49f5-a226-582ed5f8cbe4` | 6 | Under Contract |

### Seller Pipeline Stages

| Stage | ID | Position | Baserow Deal Stage |
|-------|-----|----------|-------------------|
| Lead | `e5ab1bad-c614-483b-9358-8fdcce1d0efc` | 0 | Initial Interest |
| Engaged Seller | `6e65fd88-18e3-4b32-84fe-306e23709b93` | 1 | Initial Interest |
| Buyer Outreach & NDA Execution | `52256d41-5453-4862-8374-70eaad2eb93e` | 2 | NDA Signed |
| LOI Stage | `6f12394d-3abc-4291-9d8f-99e2d1ae57f7` | 3 | LOI Submitted |
| Collecting Due Diligence | `1a276b5a-cf00-45e8-b61f-4a8904a14350` | 4 | Due Diligence |
| Deal Finalization | `b3fa299f-5bd0-477d-966f-9609f4b8a2e8` | 5 | Under Contract |
| Closing | `209f67f6-6802-497f-b0cc-476a1812da6c` | 6 | Under Contract |

### GHL Tags

| Tag | ID | Contact Type Mapping | Source Mapping |
|-----|-----|---------------------|----------------|
| potential buyer | `XVO1pLP8953flzc9jsaN` | Buyer | - |
| affiliate | `xCHW6wEkOB0w3n9tEvbz` | Advisor | - |
| lead | `5FGJwgkrM7Imaq7rFVse` | - | - |
| general newsletter | `MhpR5LyhyA5gMX0Tf0wf` | - | Website |
| nda purchased | `nqt5pZyDD4wNQRTwq5pa` | - | Deal Academy |
| loi - purchased | `J1SpkAwD95a6I8hFt3JE` | - | Deal Academy |
| loi - granted | `vWETPVnwXem0WdjLMH2W` | - | - |
| dnd | `TjAck7RhFDnJGg2a7Wy2` | - (Status=Inactive) | - |
| deal masterclass member - sept. 2024 | `FH4fuOE0z4CJyKe0pgDj` | - | Deal Academy |
| deligence course | `giLUGeTczUIIoTEOfB7n` | - | Deal Academy |
| 2025 registrant - buying and selling... | `J4o3ktUNYTxJ0wGtcxDg` | - | Conference |
| 2025 registrant - virtual panel... | `3yezxrKiKx21T3YSMoQr` | - | Conference |
| buying and selling accounting firms webinar registrant | `6vV0BM9s9Qcznz9AHC3l` | - | Conference |
| purchased | `RwLuZ1BrFoelPiemDSjE` | - | Deal Academy |
| seamless cpa list | `Zk0zWgD1X0aLdpBy6Emg` | - | Other |
| starting a business 101 - purchased | `EKDY2g6pU6lvevYR95Np` | - | Deal Academy |

### GHL Contact Custom Fields

| Field Name | ID | Type | Baserow Target |
|------------|-----|------|----------------|
| Profession | `3vGl0xfHpmS3KDteHpw8` | TEXT | Contacts.Title |
| Project Description | `NDllPZhdOFZvwmDwYeLM` | LARGE_TEXT | Contacts.Notes |
| Your Message | `NWVbZpTcilGFW4G1itV3` | LARGE_TEXT | Contacts.Notes |
| Additional Comments | `hr5crKmXPvtgmQs94fAs` | LARGE_TEXT | Contacts.Notes |
| Date | `Q6nRoOMrvcEm5LYDezZR` | DATE | Activities.Activity Date |
| Signature | `Cm9Iznv2dyu8oc2zYzbs` | SIGNATURE | Documents |

### GHL Opportunity Custom Fields

| Field Name | ID | Type | Baserow Target |
|------------|-----|------|----------------|
| State | `tt7gHxWQm9krvDKPfqaZ` | TEXT | Seller Profiles.State |
| City | `vEiJyAYJiHWY9hkgDEpt` | TEXT | (not mapped) |
| Business Value | `zbKMzgAweiTGuEMiQMQS` | MONETARY | Deals.Deal Value |

---

## Baserow Table Schema

### Contacts (Table ID: 817355)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012167` | text | - |
| Email | `7012618` | email | - |
| Phone | `7012619` | phone_number | - |
| Company | `7012620` | text | - |
| Title | `7012621` | text | - |
| Contact Type | `7012622` | single_select | Buyer(5147198), Seller(5147199), Both(5147200), Advisor(5147201), Other(5147202) |
| Status | `7012623` | single_select | Active(5147203), Inactive(5147204), Do Not Contact(5147205) |
| Source | `7012624` | single_select | Website(5147206), Referral(5147207), LinkedIn(5147208), Conference(5147209), Cold Outreach(5147210), Other(5147211), Deal Academy(5148110) |
| Notes | `7012625` | long_text | - |
| Created | `7012626` | created_on | - (read-only) |
| Last Modified | `7012627` | last_modified | - (read-only) |
| Buyer Profiles | `7012632` | link_row → 817366 | - |
| Seller Profiles | `7012649` | link_row → 817368 | - |
| Activities | `7012782` | link_row → 817377 | - |
| Documents | `7012800` | link_row → 817382 | - |
| Marketing Attribution | `7012813` | link_row → 817383 | - |
| **ghl_contact_id** | `7014113` | text | GHL Contact ID for sync tracking |

### Buyer Profiles (Table ID: 817366)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012628` | text | - |
| Notes | `7012629` | long_text | - |
| Active | `7012630` | boolean | - |
| Contact | `7012631` | link_row → 817355 | - |
| Target Revenue Min | `7012633` | number | - |
| Target Revenue Max | `7012634` | number | - |
| Target States | `7012635` | multiple_select | CA, TX, FL, NY, IL, Nationwide |
| Practice Types | `7012636` | multiple_select | Tax, Audit, Bookkeeping, Advisory, Any |
| Funding Status | `7012637` | single_select | Pre-Qualified, Exploring, Not Qualified, Cash Buyer |
| Acquisition Timeline | `7012643` | single_select | 0-6 months, 6-12 months, 12+ months, Opportunistic |
| Is Actively Looking | `7012644` | boolean | - |
| Deals | `7012688` | link_row → 817373 | - |

### Seller Profiles (Table ID: 817368)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012645` | text | - |
| Notes | `7012646` | long_text | - |
| Active | `7012647` | boolean | - |
| Contact | `7012648` | link_row → 817355 | - |
| Firm Name | `7012650` | text | - |
| Annual Revenue | `7012651` | number | - |
| State | `7012652` | single_select | CA, TX, FL, NY, IL, Other |
| Practice Type | `7012653` | single_select | Tax, Audit, Bookkeeping, Advisory, Full Service |
| Motivation | `7012654` | single_select | Retirement, Health, Burnout, Partnership Dispute, Growth Capital, Other |
| Timeline to Sell | `7012655` | single_select | ASAP, 0-6 months, 6-12 months, 12+ months |
| Asking Price | `7012656` | number | - |
| Staff Count | `7012657` | number | - |
| Willing to Stay Post-Sale | `7012658` | boolean | - |
| Transition Period | `7012660` | single_select | None, 3 months, 6 months, 1 year, 2+ years |
| Listings | `7012675` | link_row | - |

### Deals (Table ID: 817373)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012683` | text | - |
| Notes | `7012684` | long_text | - |
| Active | `7012685` | boolean | - |
| Buyer | `7012687` | link_row → 817366 | - |
| Listing | `7012689` | link_row | - |
| Deal Stage | `7012691` | single_select | Initial Interest, NDA Signed, Due Diligence, LOI Submitted, LOI Accepted, Under Contract, Closed Won, Closed Lost |
| Deal Value | `7012692` | number | - |
| Expected Close Date | `7012693` | date | - |
| Actual Close Date | `7012694` | date | - |
| Commission Amount | `7012695` | number | - |
| Deal Notes | `7012696` | long_text | - |
| Loss Reason | `7012697` | single_select | Price, Timing, Fit, Competition, Financing, Changed Mind, Other |
| Deal Terms | `7012703` | link_row | - |
| Activities | `7012784` | link_row → 817377 | - |
| Documents | `7012796` | link_row → 817382 | - |
| **ghl_opportunity_id** | `7014114` | text | GHL Opportunity ID for sync tracking |

### Activities (Table ID: 817377)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012730` | text | - |
| Notes | `7012731` | long_text | - |
| Active | `7012732` | boolean | - |
| Contact | `7012781` | link_row → 817355 | - |
| Deal | `7012783` | link_row → 817373 | - |
| Activity Type | `7012785` | single_select | Call, Email, Meeting, Note, Task, Document Sent, Document Received |
| Activity Date | `7012786` | date | - |
| Subject | `7012787` | text | - |
| Description | `7012788` | long_text | - |
| Outcome | `7012789` | single_select | Positive, Neutral, Negative, Follow-up Required |
| Next Action | `7012790` | text | - |
| Next Action Date | `7012791` | date | - |

### Documents (Table ID: 817382)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012792` | text | - |
| Notes | `7012793` | long_text | - |
| Active | `7012794` | boolean | - |
| Deal | `7012795` | link_row → 817373 | - |
| Listing | `7012797` | link_row | - |
| Contact | `7012799` | link_row → 817355 | - |
| Document Type | `7012801` | single_select | NDA, LOI, Purchase Agreement, Financial Statement, Tax Return, Engagement Letter, Due Diligence, Closing Document, Other |
| Document Name | `7012803` | text | - |
| Document URL | `7012804` | url | - |
| File | `7012805` | file | - |
| Status | `7012806` | single_select | Draft, Sent, Signed, Executed, Expired |
| Date Uploaded | `7012807` | date | - |
| Source | `7012808` | single_select | DocuSign, Email, Google Drive, Manual Upload |

### Marketing Attribution (Table ID: 817383)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012809` | text | - |
| Notes | `7012810` | long_text | - |
| Active | `7012811` | boolean | - |
| Contact | `7012812` | link_row → 817355 | - |
| UTM Source | `7012814` | text | - |
| UTM Medium | `7012815` | text | - |
| UTM Campaign | `7012817` | text | - |
| UTM Content | `7012818` | text | - |
| UTM Term | `7012819` | text | - |
| Lead Source | `7012820` | single_select | Website, YouTube, LinkedIn, Referral, Deal Academy, Book, Podcast, Conference, Other |
| Landing Page | `7012821` | url | - |
| Referrer URL | `7012822` | url | - |
| First Touch Date | `7012823` | date | - |
| GHL Form | `7012824` | text | - |
| GHL Contact ID | `7012825` | text | - |

---

## Field Mapping: GHL → Baserow

### Contact Sync Mapping

```python
CONTACT_FIELD_MAP = {
    # GHL field → Baserow field ID
    "firstName+lastName": 7012167,  # Name (concatenate)
    "email": 7012618,
    "phone": 7012619,
    "companyName": 7012620,
    "customFields.3vGl0xfHpmS3KDteHpw8": 7012621,  # Profession → Title
    "tags": 7012622,  # → Contact Type (logic below)
    "type+tags": 7012623,  # → Status (logic below)
    "attribution": 7012624,  # → Source (logic below)
    "customFields.*message*": 7012625,  # → Notes (concatenate)
}

# Contact Type Logic (returns option ID)
CONTACT_TYPE_MAP = {
    "Buyer": 5147198,
    "Seller": 5147199,
    "Both": 5147200,
    "Advisor": 5147201,
    "Other": 5147202
}

def get_contact_type(tags, pipelines):
    tag_names = [t.lower() for t in tags]
    if "potential buyer" in tag_names:
        return 5147198  # Buyer
    if "affiliate" in tag_names:
        return 5147201  # Advisor
    # Check pipeline membership
    if has_opportunity_in_pipeline("bZP2ihvK0wk0NaERm2TA"):  # Buyer pipeline
        return 5147198  # Buyer
    if has_opportunity_in_pipeline("u0xJpO4msaNpBqvd1anz"):  # Seller pipeline
        return 5147199  # Seller
    return 5147202  # Other

# Status Logic (returns option ID)
STATUS_MAP = {
    "Active": 5147203,
    "Inactive": 5147204,
    "Do Not Contact": 5147205
}

def get_status(ghl_type, tags):
    tag_names = [t.lower() for t in tags]
    if "dnd" in tag_names:
        return 5147205  # Do Not Contact
    if ghl_type == "customer" or "purchased" in tag_names:
        return 5147203  # Active (customer)
    return 5147203  # Active

# Source Logic (returns option ID)
SOURCE_MAP = {
    "Website": 5147206,
    "Referral": 5147207,
    "LinkedIn": 5147208,
    "Conference": 5147209,
    "Cold Outreach": 5147210,
    "Other": 5147211
}

def get_source(tags, attribution):
    tag_names = [t.lower() for t in tags]
    if any("webinar" in t or "registrant" in t for t in tag_names):
        return 5147209  # Conference
    if any("deal" in t or "course" in t for t in tag_names):
        return 5147211  # Other (Deal Academy - need to add option)
    if attribution.get("utmSessionSource") == "Social media":
        return 5147208  # LinkedIn
    if attribution.get("medium") == "referral":
        return 5147207  # Referral
    return 5147206  # Website
```

### Opportunity → Deal Sync Mapping

```python
DEAL_FIELD_MAP = {
    "name": 7012683,
    "monetaryValue": 7012692,  # Deal Value
    "customFields.zbKMzgAweiTGuEMiQMQS": 7012692,  # Business Value → Deal Value
    "pipelineStageId": 7012691,  # → Deal Stage (logic below)
    "status": 7012691,  # won/lost affects Deal Stage
    "createdAt": None,  # Created is read-only
    "notes": 7012696,  # Deal Notes
    "lostReasonId": 7012697,  # Loss Reason
}

# Stage Mapping: GHL Stage ID → Baserow Deal Stage option
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

def get_deal_stage(pipeline_id, stage_id, status):
    if status == "won":
        return "Closed Won"
    if status == "lost":
        return "Closed Lost"

    if pipeline_id == "bZP2ihvK0wk0NaERm2TA":  # Buyer
        return BUYER_STAGE_MAP.get(stage_id, "Initial Interest")
    if pipeline_id == "u0xJpO4msaNpBqvd1anz":  # Seller
        return SELLER_STAGE_MAP.get(stage_id, "Initial Interest")
    return "Initial Interest"
```

### Marketing Attribution Mapping

```python
ATTRIBUTION_FIELD_MAP = {
    "id": 7012825,  # GHL Contact ID
    "attributions[0].utmSessionSource": 7012814,  # UTM Source
    "attributions[0].medium": 7012815,  # UTM Medium
    "attributions[0].utmCampaign": 7012817,  # UTM Campaign
    "attributions[0].utmContent": 7012818,  # UTM Content
    "attributions[0].utmTerm": 7012819,  # UTM Term
    "dateAdded": 7012823,  # First Touch Date
    "source": 7012824,  # GHL Form
}

# Lead Source mapping
LEAD_SOURCE_MAP = {
    "Website": "Website",
    "YouTube": "YouTube",
    "LinkedIn": "LinkedIn",
    "Referral": "Referral",
    "Deal Academy": "Deal Academy",
    "Book": "Book",
    "Podcast": "Podcast",
    "Conference": "Conference",
    "Other": "Other"
}

def get_lead_source(utm_source, medium, tags):
    if utm_source == "Social media":
        return "LinkedIn"
    if utm_source == "Organic Search":
        return "Website"
    if medium == "referral":
        return "Referral"
    tag_names = [t.lower() for t in tags]
    if any("webinar" in t or "registrant" in t for t in tag_names):
        return "Conference"
    if any("deal" in t or "course" in t or "masterclass" in t for t in tag_names):
        return "Deal Academy"
    return "Other"
```

---

## API Examples

### Create Contact in Baserow

```python
import requests

BASEROW_TOKEN = "raapY74IuN8GlZNWPzeXmFH6YnaGrafR"
headers = {"Authorization": f"Token {BASEROW_TOKEN}", "Content-Type": "application/json"}

def create_contact(ghl_contact):
    data = {
        "field_7012167": f"{ghl_contact['firstName']} {ghl_contact['lastName']}".strip(),
        "field_7012618": ghl_contact.get("email", ""),
        "field_7012619": ghl_contact.get("phone", ""),
        "field_7012620": ghl_contact.get("companyName", ""),
        "field_7012621": get_custom_field(ghl_contact, "3vGl0xfHpmS3KDteHpw8"),  # Profession
        "field_7012622": get_contact_type(ghl_contact.get("tags", []), None),  # Contact Type
        "field_7012623": get_status(ghl_contact.get("type"), ghl_contact.get("tags", [])),  # Status
        "field_7012624": get_source(ghl_contact.get("tags", []), ghl_contact.get("attributions", [{}])[0]),
        "field_7012625": compile_notes(ghl_contact),  # Notes
    }

    r = requests.post(
        "https://api.baserow.io/api/database/rows/table/817355/",
        headers=headers,
        json=data
    )
    return r.json()
```

### Create Deal in Baserow

```python
def create_deal(ghl_opportunity, buyer_profile_id):
    deal_value = ghl_opportunity.get("monetaryValue", 0)
    if deal_value == 0:
        # Try Business Value custom field
        for cf in ghl_opportunity.get("customFields", []):
            if cf.get("id") == "zbKMzgAweiTGuEMiQMQS":
                deal_value = cf.get("fieldValueNumber", 0)
                break

    data = {
        "field_7012683": ghl_opportunity.get("name", "Unnamed Deal"),
        "field_7012687": [buyer_profile_id] if buyer_profile_id else [],  # Buyer link
        "field_7012691": get_deal_stage(
            ghl_opportunity.get("pipelineId"),
            ghl_opportunity.get("pipelineStageId"),
            ghl_opportunity.get("status")
        ),
        "field_7012692": deal_value,
        "field_7012685": True,  # Active
    }

    r = requests.post(
        "https://api.baserow.io/api/database/rows/table/817373/",
        headers=headers,
        json=data
    )
    return r.json()
```

---

## Sync Strategy

### Recommended Schedule

| Sync Job | Frequency | Direction | Script |
|----------|-----------|-----------|--------|
| Newsletter Extract | Weekly (Tue AM) | GHL → RAG | `ghl_newsletter_extractor.py` |
| Contact Sync | Daily (2 AM) | GHL → Baserow | `ghl_contact_sync.py` |
| Opportunity Sync | Hourly | GHL → Baserow | `ghl_opportunity_sync.py` |

### Deduplication

**Contacts**: Match by GHL Contact ID (primary), email (secondary), or phone (tertiary)
- Primary: `GET /api/database/rows/table/817355/?filter__field_{ghl_contact_id_field}__equal={ghl_id}`
- Secondary: `GET /api/database/rows/table/817355/?filter__field_7012618__equal={email}`
- NOTE: `ghl_contact_id` field must be created first (see IMPLEMENTATION_LOG.md)

**Deals**: Match by GHL Opportunity ID
- Primary: `GET /api/database/rows/table/817373/?filter__field_{ghl_opportunity_id_field}__equal={ghl_id}`
- NOTE: `ghl_opportunity_id` field must be created first (see IMPLEMENTATION_LOG.md)

**IMPORTANT**: The GHL ID fields are PENDING creation. See `/docs/IMPLEMENTATION_LOG.md` for status and instructions.

### Error Handling

- Log all API failures with full request/response
- Implement exponential backoff for rate limits (429)
- Queue failed items for retry
- Alert on >10% failure rate

---

### Listings (Table ID: 817371)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012668` | text | - |
| Notes | `7012669` | long_text | - |
| Active | `7012670` | boolean | - |
| Seller Profile | `7012674` | link_row → 817368 | - |
| Listing Status | `7012677` | single_select | Draft(5147262), Active(5147263), Under LOI(5147264), Sold(5147265), Withdrawn(5147266) |
| Asking Price | `7012678` | number | - |
| Date Listed | `7012679` | date | - |
| Description | `7012680` | long_text | - |
| Key Highlights | `7012681` | long_text | - |
| Listing Code | `7012682` | text | - |
| Deals | `7012690` | link_row → 817373 | - |
| Documents | `7012798` | link_row → 817382 | - |

### Deal Terms (Table ID: 817374)

| Field | ID | Type | Select Options (IDs) |
|-------|-----|------|---------------------|
| Name | `7012698` | text | - |
| Notes | `7012699` | long_text | - |
| Active | `7012700` | boolean | - |
| Deal | `7012702` | link_row → 817373 | - |
| Purchase Price | `7012704` | number | - |
| Down Payment | `7012705` | number | - |
| Down Payment Percent | `7012706` | number | - |
| Seller Financing Amount | `7012707` | number | - |
| Seller Financing Rate | `7012708` | number | - |
| Seller Financing Term Months | `7012709` | number | - |
| Earnout Amount | `7012710` | number | - |
| Earnout Terms | `7012711` | long_text | - |
| Non-Compete Years | `7012713` | number | - |
| Non-Compete Radius Miles | `7012714` | number | - |
| Transition Period Months | `7012715` | number | - |
| Employment Agreement | `7012716` | boolean | - |
| Sale Type | `7012717` | single_select | Asset Sale(5147284), Stock Sale(5147285), Hybrid(5147286) |
| Closing Date | `7012718` | date | - |
| Revenue Multiple | `7012719` | number | - |
| Source Document | `7012725` | text | - |
| Extraction Confidence | `7012726` | single_select | High(5147287), Medium(5147288), Low(5147289), Manual Review(5147290) |

---

## Data Notes

### Current Data Volume
- GHL Contacts: ~2,487
- GHL Opportunities: 2
- Baserow Contacts: 3 (test data)

### Known Issues
1. Some GHL custom fields are form-specific and rarely populated
2. Most contacts lack companyName
3. 76% of contacts are from "general newsletter" tag
