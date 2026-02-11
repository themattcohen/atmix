# GHL → Baserow CRM Mapping

## GHL Data Summary

**Location ID:** `oKvxmpgImkZb3TwM9ii4`
**Total Contacts:** 2,487
**Total Opportunities:** 2 (both in Buyer pipeline)

---

## GHL Structure Analysis

### Pipelines (4)

| Pipeline | ID | Stages |
|----------|-----|--------|
| **Buyer** | bZP2ihvK0wk0NaERm2TA | Lead → Engaged Buyer → Seller Outreach & NDA → LOI Submitted → Due Diligence → Financing → Closing |
| **Seller** | u0xJpO4msaNpBqvd1anz | Lead → Engaged Seller → Buyer Outreach & NDA → LOI Stage → Collecting DD → Deal Finalization → Closing |
| Free Consult Call | CvVxDxxvx0TSOIgJWJpR | New Leads → Hot Leads → Booking Requested → Booking Confirmed → Service(s) Sold |
| Consulting Engagement | dRorUtGFyRjqwQMbLKji | Won/Send Contract |

### Contact Tags (16)

| Tag | ID | Baserow Mapping |
|-----|-----|-----------------|
| potential buyer | XVO1pLP8953flzc9jsaN | Contact Type = Buyer |
| lead | 5FGJwgkrM7Imaq7rFVse | Status = Lead |
| general newsletter | MhpR5LyhyA5gMX0Tf0wf | Source = Newsletter |
| affiliate | xCHW6wEkOB0w3n9tEvbz | Contact Type = Advisor |
| nda purchased | nqt5pZyDD4wNQRTwq5pa | Document created |
| loi - purchased | J1SpkAwD95a6I8hFt3JE | Document created |
| loi - granted | vWETPVnwXem0WdjLMH2W | Deal Stage = LOI |
| dnd | TjAck7RhFDnJGg2a7Wy2 | Status = Inactive |
| deal masterclass member - sept. 2024 | FH4fuOE0z4CJyKe0pgDj | Source = Deal Academy |
| deligence course | giLUGeTczUIIoTEOfB7n | Source = Deal Academy |
| 2025 registrant - buying and selling... | J4o3ktUNYTxJ0wGtcxDg | Source = Webinar |
| 2025 registrant - virtual panel... | 3yezxrKiKx21T3YSMoQr | Source = Webinar |
| buying and selling accounting firms webinar registrant | 6vV0BM9s9Qcznz9AHC3l | Source = Webinar |
| purchased | RwLuZ1BrFoelPiemDSjE | Status = Customer |
| seamless cpa list | Zk0zWgD1X0aLdpBy6Emg | Source = List |
| starting a business 101 - purchased | EKDY2g6pU6lvevYR95Np | Source = Course |

### Contact Custom Fields (13)

| Field Name | ID | Type | Notes |
|------------|-----|------|-------|
| Profession | 3vGl0xfHpmS3KDteHpw8 | TEXT | Map to Title |
| Project Description | NDllPZhdOFZvwmDwYeLM | LARGE_TEXT | Map to Notes |
| Your Message | NWVbZpTcilGFW4G1itV3 | LARGE_TEXT | Map to Notes |
| Additional Comments | hr5crKmXPvtgmQs94fAs | LARGE_TEXT | Map to Notes |
| Date | Q6nRoOMrvcEm5LYDezZR | DATE | Activity date |
| Signature | Cm9Iznv2dyu8oc2zYzbs | SIGNATURE | Document field |
| Multi Line * | various | LARGE_TEXT | Form responses |
| Single Line 2h0y | a7PoceNX8vYN0BrCYAAS | TEXT | Form response |

### Opportunity Custom Fields (3)

| Field Name | ID | Type | Baserow Mapping |
|------------|-----|------|-----------------|
| State | tt7gHxWQm9krvDKPfqaZ | TEXT | Seller Profiles.State |
| City | vEiJyAYJiHWY9hkgDEpt | TEXT | (new field needed) |
| Business Value | zbKMzgAweiTGuEMiQMQS | MONETARY | Deals.Deal Value |

---

## Field Mapping: GHL → Baserow

### Contacts Table (817355)

| GHL Field | Baserow Field | Notes |
|-----------|---------------|-------|
| `id` | (store as GHL ID in Notes) | Reference for sync |
| `firstName` + `lastName` | Name | Concatenate |
| `email` | Email | Direct map |
| `phone` | Phone | Direct map |
| `companyName` | Company | Direct map |
| `customFields[Profession]` | Title | Field ID: 3vGl0xfHpmS3KDteHpw8 |
| `tags` (analysis) | Contact Type | See tag mapping logic |
| `type` | Status | lead → Active, customer → Customer |
| `source` | Source | Map to select options |
| `customFields[messages]` | Notes | Concatenate message fields |
| `dateAdded` | Created | Direct map |
| `dateUpdated` | Last Modified | Direct map |

**Contact Type Logic:**
```python
if "potential buyer" in tags:
    contact_type = "Buyer"
elif "affiliate" in tags:
    contact_type = "Advisor"
elif in_seller_pipeline:
    contact_type = "Seller"
elif in_buyer_pipeline:
    contact_type = "Buyer"
else:
    contact_type = "Other"
```

**Status Logic:**
```python
if "dnd" in tags:
    status = "Inactive"
elif type == "customer" or "purchased" in tags:
    status = "Customer"
else:
    status = "Active"
```

**Source Logic:**
```python
if "deal masterclass" in tags or "deligence course" in tags:
    source = "Deal Academy"
elif "webinar" in any_tag:
    source = "Webinar"
elif "general newsletter" in tags:
    source = "Newsletter"
elif attribution.medium == "zapier":
    source = "Zapier Import"
else:
    source = ghl_source or "Other"
```

### Buyer Profiles Table (817366)

Create when contact is in Buyer pipeline or tagged "potential buyer":

| GHL Field | Baserow Field |
|-----------|---------------|
| `opportunity.customFields[Business Value]` | Target Revenue Max |
| `opportunity.customFields[State]` | Target States |
| Pipeline stage analysis | Acquisition Timeline |
| Has active opportunity | Is Actively Looking |

### Seller Profiles Table (817368)

Create when contact is in Seller pipeline:

| GHL Field | Baserow Field |
|-----------|---------------|
| `companyName` | Firm Name |
| `opportunity.customFields[Business Value]` | Annual Revenue |
| `opportunity.customFields[State]` | State |
| Pipeline stage analysis | Timeline to Sell |

### Deals Table (817373)

Map from GHL Opportunities:

| GHL Field | Baserow Field |
|-----------|---------------|
| `opportunity.id` | (reference) |
| `opportunity.name` | Name |
| `opportunity.monetaryValue` | Deal Value |
| `opportunity.customFields[Business Value]` | Deal Value (if monetaryValue=0) |
| `opportunity.pipelineStageId` | Deal Stage (map below) |
| `opportunity.status` | Deal Stage (open/won/lost) |
| `opportunity.createdAt` | Created |
| `opportunity.lostReasonId` | Loss Reason |

**Deal Stage Mapping (Buyer Pipeline):**

| GHL Stage | Baserow Stage |
|-----------|---------------|
| Lead | Initial Interest |
| Engaged Buyer | Initial Interest |
| Seller Outreach & NDA Execution | NDA Signed |
| LOI Submitted | LOI Submitted |
| Due Diligence | Due Diligence |
| Financing & Bank Process | Under Contract |
| Closing | Under Contract |
| (status=won) | Closed Won |
| (status=lost) | Closed Lost |

**Deal Stage Mapping (Seller Pipeline):**

| GHL Stage | Baserow Stage |
|-----------|---------------|
| Lead | Initial Interest |
| Engaged Seller | Initial Interest |
| Buyer Outreach & NDA Execution | NDA Signed |
| LOI Stage | LOI Submitted |
| Collecting Due Diligence | Due Diligence |
| Deal Finalization | Under Contract |
| Closing | Under Contract |
| (status=won) | Closed Won |
| (status=lost) | Closed Lost |

### Marketing Attribution Table (817383)

| GHL Field | Baserow Field |
|-----------|---------------|
| `attributions[].utmSessionSource` | UTM Source |
| `attributions[].medium` | UTM Medium |
| `attributions[].utmCampaign` | UTM Campaign |
| `attributions[].utmContent` | UTM Content |
| `attributions[].utmTerm` | UTM Term |
| (derive from medium/source) | Lead Source |
| `source` | GHL Form |
| `id` | GHL Contact ID |
| `dateAdded` | First Touch Date |

**Lead Source Logic:**
```python
if utmSessionSource == "Social media":
    lead_source = "LinkedIn"  # or other social
elif utmSessionSource == "Organic Search":
    lead_source = "Website"
elif "webinar" in tags:
    lead_source = "Website"
elif "deal" in tags or "course" in tags:
    lead_source = "Deal Academy"
elif medium == "referral":
    lead_source = "Referral"
else:
    lead_source = "Other"
```

---

## Sync Strategy

### Initial Import

1. **Contacts First**: Import all 2,487 contacts to Baserow Contacts table
2. **Identify Buyers/Sellers**: Based on tags and pipeline membership
3. **Create Profiles**: Buyer Profiles and Seller Profiles as needed
4. **Import Opportunities**: Map to Deals table
5. **Attribution Data**: Create Marketing Attribution records

### Ongoing Sync (via Automations)

**GHL → Baserow (Webhooks):**
- Contact created/updated → Update Contacts
- Opportunity stage changed → Update Deals
- Contact tagged → Update Contact Type/Status

**Baserow → GHL (API calls):**
- New Contact → Create in GHL
- Deal stage change → Update Opportunity
- Activity logged → Create GHL task/note

---

## API Endpoints Reference

**Base URL:** `https://services.leadconnectorhq.com`

| Resource | Endpoint | Method |
|----------|----------|--------|
| Contacts | `/contacts/?locationId={id}` | GET |
| Contact | `/contacts/{contactId}` | GET/PUT/POST |
| Opportunities | `/opportunities/search` | POST |
| Pipelines | `/opportunities/pipelines?locationId={id}` | GET |
| Custom Fields | `/locations/{id}/customFields` | GET |
| Tags | `/locations/{id}/tags` | GET |

**Headers Required:**
```
Authorization: Bearer {GHL_API_TOKEN}
Version: 2021-07-28
Content-Type: application/json
```

---

## Data Quality Notes

1. **Low Custom Field Usage**: Only 3 contacts have Profession filled
2. **Most Contacts from Zapier**: 64% imported via Zapier
3. **Newsletter Dominant**: 76% tagged "general newsletter"
4. **Few Opportunities**: Only 2 opportunities exist
5. **Missing Company Data**: Many contacts lack companyName

---

## Next Steps

1. [ ] Build Python sync script for initial import
2. [ ] Set up GHL webhooks for real-time sync
3. [ ] Create Baserow automations for bi-directional sync
4. [ ] Test with subset of contacts first
5. [ ] Document any data transformation issues
