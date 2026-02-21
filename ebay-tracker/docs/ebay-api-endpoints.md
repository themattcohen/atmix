# eBay API Complete Endpoint Reference

> Research compiled for watchlist monitoring tool development.
> Date: 2025-02-21

---

## Table of Contents

1. [API Overview & Architecture](#api-overview--architecture)
2. [Authentication](#authentication)
3. [Rate Limits](#rate-limits)
4. [Buy APIs (REST)](#buy-apis-rest)
5. [Sell APIs (REST)](#sell-apis-rest)
6. [Commerce APIs (REST)](#commerce-apis-rest)
7. [Developer APIs (REST)](#developer-apis-rest)
8. [Trading API (Legacy XML/SOAP)](#trading-api-legacy-xmlsoap)
9. [Watchlist-Specific Deep Dive](#watchlist-specific-deep-dive)
10. [Notifications & Webhooks](#notifications--webhooks)
11. [SDKs & Libraries](#sdks--libraries)
12. [Architecture Recommendations](#architecture-recommendations)

---

## API Overview & Architecture

eBay exposes two generations of APIs:

| Generation | Format | Auth | Status |
|---|---|---|---|
| **RESTful APIs** | JSON over HTTPS | OAuth 2.0 (scoped) | Active, expanding |
| **Traditional APIs** (Trading, Shopping, Finding) | XML/SOAP | OAuth 2.0 (unscoped) | Being deprecated piecemeal |

**Base URLs:**
- Production REST: `https://api.ebay.com`
- Production Trading: `https://api.ebay.com/ws/api.dll`
- Sandbox REST: `https://api.sandbox.ebay.com`
- Sandbox Trading: `https://api.sandbox.ebay.com/ws/api.dll`

**Key constraint for watchlist monitoring:** There is **no RESTful endpoint** for accessing a user's personal watchlist. The Trading API's `GetMyeBayBuying` is the only way. This is a confirmed gap with no announced REST replacement.

---

## Authentication

### OAuth 2.0 Flows

| Flow | Token Type | Lifetime | Use Case |
|---|---|---|---|
| **Client Credentials** | Application token | 2 hours | Public data (search, browse, taxonomy) |
| **Authorization Code** | User token | 2 hours (access) / ~18 months (refresh) | User data (watchlist, orders, buying, selling) |

**For watchlist access: Authorization Code Grant (User Token) is required.**

### Token Endpoints

```
POST https://api.ebay.com/identity/v1/oauth2/token
```

- Client Credentials: `grant_type=client_credentials&scope=<scopes>`
- Auth Code Exchange: `grant_type=authorization_code&code=<code>&redirect_uri=<uri>`
- Token Refresh: `grant_type=refresh_token&refresh_token=<token>&scope=<scopes>`

### OAuth Scopes (Complete List)

| Scope | Description |
|---|---|
| `https://api.ebay.com/oauth/api_scope` | View public data from eBay |
| `https://api.ebay.com/oauth/api_scope/buy.guest.order` | Purchase items without signing in |
| `https://api.ebay.com/oauth/api_scope/buy.item.feed` | View curated feeds of eBay items |
| `https://api.ebay.com/oauth/api_scope/buy.marketing` | Retrieve product/listing data for marketing |
| `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights` | View historical sales data |
| `https://api.ebay.com/oauth/api_scope/buy.offer.auction` | View and manage bidding activities |
| `https://api.ebay.com/oauth/api_scope/buy.order.readonly` | View order details |
| `https://api.ebay.com/oauth/api_scope/buy.product.feed` | View curated product feeds |
| `https://api.ebay.com/oauth/api_scope/buy.proxy.guest.order` | Guest orders via external vault |
| `https://api.ebay.com/oauth/api_scope/buy.shopping.cart` | View and manage shopping cart |
| `https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly` | Search eBay product catalog |
| `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly` | View user basic info |
| `https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly` | View user email |
| `https://api.ebay.com/oauth/api_scope/commerce.identity.phone.readonly` | View user phone |
| `https://api.ebay.com/oauth/api_scope/commerce.identity.address.readonly` | View user address |
| `https://api.ebay.com/oauth/api_scope/commerce.identity.name.readonly` | View user name |
| `https://api.ebay.com/oauth/api_scope/commerce.notification.subscription` | Manage notification subscriptions |
| `https://api.ebay.com/oauth/api_scope/sell.account` | Manage account settings |
| `https://api.ebay.com/oauth/api_scope/sell.account.readonly` | View account settings |
| `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly` | View selling analytics |
| `https://api.ebay.com/oauth/api_scope/sell.finances` | View/manage payments and orders |
| `https://api.ebay.com/oauth/api_scope/sell.fulfillment` | Manage order fulfillments |
| `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly` | View order fulfillments |
| `https://api.ebay.com/oauth/api_scope/sell.inventory` | Manage inventory/offers |
| `https://api.ebay.com/oauth/api_scope/sell.inventory.readonly` | View inventory/offers |
| `https://api.ebay.com/oauth/api_scope/sell.item.draft` | Manage item drafts |
| `https://api.ebay.com/oauth/api_scope/sell.marketing` | Manage marketing activities |
| `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly` | View marketing activities |
| `https://api.ebay.com/oauth/api_scope/sell.marketplace.insights.readonly` | View product selling data |

**Important:** The Trading API does NOT use granular scopes. An OAuth user token passed to the Trading API grants full access.

### Using OAuth with Trading API

Pass the token via HTTP header (do NOT use `<RequesterCredentials>` XML element):

```
X-EBAY-API-IAF-TOKEN: v^1.1#i^1#...
```

---

## Rate Limits

### OAuth Token Limits

| Grant Type | Daily Limit |
|---|---|
| Client credentials | 1,000 requests/day |
| Authorization code | 10,000 requests/day |
| Refresh token | 50,000 requests/day |

### API Call Limits (Default Tier)

#### Buy APIs

| API | Daily Limit |
|---|---|
| Browse API | 5,000 |
| Deal API | 5,000 |
| Buy Feed v1 | 75,000 |
| Order APIs | 5,000 each |

#### Sell APIs

| API | Daily Limit |
|---|---|
| Account API | 25,000 |
| Inventory API | 2,000,000 |
| Logistics API | 2,500,000 |
| Feed API | 100,000 |
| Fulfillment API | 100,000 |
| Marketing Promotion API | 100,000 |
| Negotiation API | 1,000,000 |
| Inventory Mapping API | 20 |

#### Commerce APIs

| API | Daily Limit |
|---|---|
| Media API | 1,000,000 |
| Catalog API | 10,000 |
| Notification API | 10,000 |

#### Trading API

| Metric | Default |
|---|---|
| Daily aggregate | 5,000 calls/day |
| After Growth Check | Up to 1,500,000 calls/day |

### Rate Limit Headers

```
X-eBay-C-RateLimit-Limit
X-eBay-C-RateLimit-Remaining
X-eBay-C-RateLimit-Reset
```

### Increasing Limits

Complete the **Application Growth Check** to verify compliance and request higher limits.

---

## Buy APIs (REST)

Base path: `https://api.ebay.com/buy`

### Browse API v1 — `/buy/browse/v1`

The primary API for searching and viewing items. **7 endpoints.**

| Method | Path | Description |
|---|---|---|
| GET | `/item_summary/search` | Search listings with filters, aspects, category |
| POST | `/item_summary/search_by_image` | Search by Base64 image |
| GET | `/item/{item_id}` | Get detailed item info by RESTful ID |
| GET | `/item/get_item_by_legacy_id` | Get item by legacy (Trading API) item ID |
| GET | `/item/` | Batch get up to 20 items by ID |
| GET | `/item/get_items_by_item_group` | Get item variations within a group |
| POST | `/item/{item_id}/check_compatibility` | Check product compatibility |

**Scope:** `api_scope` (application token sufficient for all)

### Deal API v1 — `/buy/deal/v1` (Limited Release)

| Method | Path | Description |
|---|---|---|
| GET | `/deal_item` | Search deal items |
| GET | `/event` | Get all marketplace events |
| GET | `/event/{event_id}` | Get specific event details |
| GET | `/event_item` | Search event items |

### Buy Feed API v1 — `/buy/feed/v1` (Limited Release)

| Method | Path | Description |
|---|---|---|
| GET | `/item` | Download single-variation listing feed (TSV_GZIP) |
| GET | `/item_group` | Download multi-variation listing feed |
| GET | `/item_snapshot` | Hourly snapshot of modified items |
| GET | `/item_priority` | Promoted Listings feed |

### Buy Marketing API v1 — `/buy/marketing/v1_beta`

| Method | Path | Description |
|---|---|---|
| GET | `/merchandised_product` | Get best-selling products by category |

**Note:** `getMostWatchedItems` returns aggregate marketplace data (most-watched by all users), NOT a user's personal watchlist.

### Buy Marketplace Insights API v1 — `/buy/marketplace_insights/v1_beta`

| Method | Path | Description |
|---|---|---|
| GET | `/item_sales/search` | Search completed/sold items (historical sales data) |

### Buy Offer API v1 — `/buy/offer/v1_beta` (Limited Release)

| Method | Path | Description |
|---|---|---|
| GET | `/bidding/{item_id}` | Get bidding details for an active bid |
| POST | `/bidding/{item_id}/place_proxy_bid` | Place automatic proxy bid on auction |

**Scope:** `buy.offer.auction` (user token required)

### Buy Order API v2 — `/buy/order/v2` (Limited Release)

| Method | Path | Description |
|---|---|---|
| POST | `/guest_checkout_session/initiate` | Start guest checkout |
| GET | `/guest_checkout_session/{id}` | Get checkout session details |
| POST | `/guest_checkout_session/{id}/apply_coupon` | Apply coupon |
| POST | `/guest_checkout_session/{id}/remove_coupon` | Remove coupon |
| POST | `/guest_checkout_session/{id}/update_quantity` | Update quantities |
| POST | `/guest_checkout_session/{id}/update_shipping_address` | Update shipping address |
| POST | `/guest_checkout_session/{id}/update_shipping_option` | Update shipping option |
| GET | `/guest_purchase_order/{id}` | Get guest order details |

---

## Sell APIs (REST)

Base path: `https://api.ebay.com/sell`

### Account API v1 — `/sell/account/v1`

**43 endpoints** across 12 resources.

#### custom_policy
| Method | Path | Description |
|---|---|---|
| POST | `/custom_policy/` | Create custom compliance/takeback policy |
| GET | `/custom_policy/` | Get all custom policies by type |
| GET | `/custom_policy/{id}` | Get specific custom policy |
| PUT | `/custom_policy/{id}` | Update custom policy |

#### fulfillment_policy
| Method | Path | Description |
|---|---|---|
| POST | `/fulfillment_policy/` | Create fulfillment policy |
| DELETE | `/fulfillment_policy/{id}` | Delete fulfillment policy |
| GET | `/fulfillment_policy` | Get all fulfillment policies |
| GET | `/fulfillment_policy/{id}` | Get specific fulfillment policy |
| GET | `/fulfillment_policy/get_by_policy_name` | Get by name |
| PUT | `/fulfillment_policy/{id}` | Update fulfillment policy |

#### payment_policy
| Method | Path | Description |
|---|---|---|
| POST | `/payment_policy` | Create payment policy |
| DELETE | `/payment_policy/{id}` | Delete payment policy |
| GET | `/payment_policy` | Get all payment policies |
| GET | `/payment_policy/{id}` | Get specific payment policy |
| GET | `/payment_policy/get_by_policy_name` | Get by name |
| PUT | `/payment_policy/{id}` | Update payment policy |

#### return_policy
| Method | Path | Description |
|---|---|---|
| POST | `/return_policy` | Create return policy |
| DELETE | `/return_policy/{id}` | Delete return policy |
| GET | `/return_policy` | Get all return policies |
| GET | `/return_policy/{id}` | Get specific return policy |
| GET | `/return_policy/get_by_policy_name` | Get by name |
| PUT | `/return_policy/{id}` | Update return policy |

#### sales_tax
| Method | Path | Description |
|---|---|---|
| POST | `/bulk_create_or_replace_sales_tax` | Bulk create/update sales tax entries |
| PUT | `/sales_tax/{countryCode}/{jurisdictionId}` | Create/update single sales tax entry |
| DELETE | `/sales_tax/{countryCode}/{jurisdictionId}` | Delete sales tax entry |
| GET | `/sales_tax/{countryCode}/{jurisdictionId}` | Get sales tax entry |
| GET | `/sales_tax` | Get sales tax table for country |

#### Other resources
| Method | Path | Description |
|---|---|---|
| GET | `/payments_program/{marketplace}/{type}` | Payment program status (deprecated) |
| GET | `/payments_program/{marketplace}/{type}/onboarding` | Onboarding status (deprecated) |
| GET | `/privilege` | Get seller privileges/limits |
| GET | `/program/get_opted_in_programs` | List opted-in programs |
| POST | `/program/opt_in` | Opt into eBay program |
| POST | `/program/opt_out` | Opt out of eBay program |
| GET | `/rate_table` | Get shipping rate tables |
| GET | `/subscription` | Get account subscriptions |
| GET | `/kyc` | KYC check items (deprecated) |
| GET | `/advertising_eligibility` | Advertising program eligibility |

### Sell Analytics API v1 — `/sell/analytics/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/customer_service_metric/{type}/{eval_type}` | Customer service metrics |
| GET | `/seller_standards_profile` | All seller standards profiles |
| GET | `/seller_standards_profile/{program}/{cycle}` | Specific standards profile |
| GET | `/traffic_report` | Listing traffic report |

### Sell Compliance API v1 — `/sell/compliance/v1` (DEPRECATED - decommissioned 2026-03-30)

| Method | Path | Description |
|---|---|---|
| GET | `/listing_violation_summary` | Listing violation counts |
| GET | `/listing_violation` | Specific listing violations |

### Sell Feed API v1 — `/sell/feed/v1`

**19 endpoints** across 5 resources.

#### order_task
| Method | Path | Description |
|---|---|---|
| POST | `/order_task` | Create order report task |
| GET | `/order_task/{task_id}` | Get order task details |
| GET | `/order_task` | Search order tasks |

#### inventory_task
| Method | Path | Description |
|---|---|---|
| POST | `/inventory_task` | Create inventory report task |
| GET | `/inventory_task/{task_id}` | Get inventory task details |
| GET | `/inventory_task` | Search inventory tasks |

#### schedule
| Method | Path | Description |
|---|---|---|
| POST | `/schedule` | Create scheduled report job |
| DELETE | `/schedule/{id}` | Delete schedule |
| GET | `/schedule/{id}/download_result_file` | Download scheduled report |
| GET | `/schedule/{id}` | Get schedule details |
| GET | `/schedule` | Search schedules |
| GET | `/schedule_template/{id}` | Get schedule template |
| GET | `/schedule_template` | Search schedule templates |
| PUT | `/schedule/{id}` | Update schedule |

#### task
| Method | Path | Description |
|---|---|---|
| POST | `/task` | Create upload feed task |
| GET | `/task/{id}/download_input_file` | Download input file |
| GET | `/task/{id}/download_result_file` | Download result file |
| GET | `/task/{id}` | Get task details |
| GET | `/task` | Search tasks |
| POST | `/task/{id}/upload_file` | Upload feed file |

#### customer_service_metric_task
| Method | Path | Description |
|---|---|---|
| POST | `/customer_service_metric_task` | Create CS metric task |
| GET | `/customer_service_metric_task/{id}` | Get CS metric task |
| GET | `/customer_service_metric_task` | Search CS metric tasks |

### Sell Finances API v1 — `/sell/finances/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/payout/{id}` | Get specific payout |
| GET | `/payout` | Search payouts |
| GET | `/payout_summary` | Payout summary totals |
| GET | `/seller_funds_summary` | Pending funds summary |
| GET | `/transaction` | Search transactions |
| GET | `/transaction_summary` | Transaction summary totals |
| GET | `/transfer/{id}` | Get transfer details |
| GET | `/billing_activity` | Get billing activities |

### Sell Fulfillment API v1 — `/sell/fulfillment/v1`

**15 endpoints** across 3 resources.

#### order
| Method | Path | Description |
|---|---|---|
| GET | `/order/{orderId}` | Get specific order |
| GET | `/order` | Search orders |
| POST | `/order/{id}/issue_refund` | Issue refund |

#### shipping_fulfillment
| Method | Path | Description |
|---|---|---|
| POST | `/order/{orderId}/shipping_fulfillment` | Create shipping fulfillment |
| GET | `/order/{orderId}/shipping_fulfillment/{id}` | Get fulfillment details |
| GET | `/order/{orderId}/shipping_fulfillment` | Get all fulfillments for order |

#### payment_dispute
| Method | Path | Description |
|---|---|---|
| GET | `/payment_dispute/{id}` | Get dispute details |
| GET | `/payment_dispute/{id}/fetch_evidence_content` | Get evidence file |
| GET | `/payment_dispute/{id}/activity` | Get dispute activity log |
| GET | `/payment_dispute_summary` | Search disputes |
| POST | `/payment_dispute/{id}/contest` | Contest dispute |
| POST | `/payment_dispute/{id}/accept` | Accept dispute |
| POST | `/payment_dispute/{id}/upload_evidence_file` | Upload evidence |
| POST | `/payment_dispute/{id}/add_evidence` | Add evidence set |
| POST | `/payment_dispute/{id}/update_evidence` | Update evidence set |

### Sell Inventory API v1 — `/sell/inventory/v1`

**36 endpoints** across 6 resources.

#### inventory_item
| Method | Path | Description |
|---|---|---|
| POST | `/bulk_create_or_replace_inventory_item` | Bulk create/update up to 25 items |
| POST | `/bulk_get_inventory_item` | Bulk get up to 25 items |
| POST | `/bulk_update_price_quantity` | Bulk update prices/quantities |
| PUT | `/inventory_item/{sku}` | Create/replace inventory item |
| DELETE | `/inventory_item/{sku}` | Delete inventory item |
| GET | `/inventory_item/{sku}` | Get inventory item |
| GET | `/inventory_item` | Get all inventory items |

#### product_compatibility
| Method | Path | Description |
|---|---|---|
| PUT | `/inventory_item/{sku}/product_compatibility` | Set product compatibility |
| DELETE | `/inventory_item/{sku}/product_compatibility` | Delete compatibility data |
| GET | `/inventory_item/{sku}/product_compatibility` | Get compatibility data |

#### inventory_item_group
| Method | Path | Description |
|---|---|---|
| PUT | `/inventory_item_group/{key}` | Create/update item group |
| DELETE | `/inventory_item_group/{key}` | Delete item group |
| GET | `/inventory_item_group/{key}` | Get item group |

#### listing
| Method | Path | Description |
|---|---|---|
| POST | `/bulk_migrate_listing` | Migrate existing listings to Inventory API |
| PUT | `/listing/{listingId}/sku/{sku}/locations` | Create SKU location mapping |
| DELETE | `/listing/{listingId}/sku/{sku}/locations` | Delete SKU location mapping |
| GET | `/listing/{listingId}/sku/{sku}/locations` | Get SKU location mapping |

#### offer
| Method | Path | Description |
|---|---|---|
| POST | `/bulk_create_offer` | Bulk create up to 25 offers |
| POST | `/bulk_publish_offer` | Bulk publish up to 25 offers |
| POST | `/offer` | Create offer |
| DELETE | `/offer/{offerId}` | Delete offer |
| POST | `/offer/get_listing_fees` | Estimate listing fees |
| GET | `/offer/{offerId}` | Get offer |
| GET | `/offer` | Get offers for SKU |
| POST | `/offer/{offerId}/publish` | Publish offer (creates live listing) |
| POST | `/offer/publish_by_inventory_item_group` | Publish multi-SKU offer |
| PUT | `/offer/{offerId}` | Update offer |
| POST | `/offer/{offerId}/withdraw` | End single-SKU listing |
| POST | `/offer/withdraw_by_inventory_item_group` | End multi-SKU listing |

#### location
| Method | Path | Description |
|---|---|---|
| POST | `/location/{key}` | Create inventory location |
| DELETE | `/location/{key}` | Delete inventory location |
| POST | `/location/{key}/disable` | Disable location |
| POST | `/location/{key}/enable` | Enable location |
| GET | `/location/{key}` | Get location |
| GET | `/location` | Get all locations |
| POST | `/location/{key}/update_location_details` | Update location |

### Sell Listing API v1_beta — `/sell/listing/v1_beta` (Limited Release)

| Method | Path | Description |
|---|---|---|
| POST | `/item_draft/` | Create draft listing on eBay |

### Sell Logistics API v1_beta — `/sell/logistics/v1_beta` (Limited Release, USPS only)

| Method | Path | Description |
|---|---|---|
| POST | `/shipment/{id}/cancel` | Cancel shipment |
| POST | `/shipment/create_from_shipping_quote` | Create shipment from quote |
| GET | `/shipment/{id}/download_label_file` | Download shipping label PDF |
| GET | `/shipment/{id}` | Get shipment details |
| POST | `/shipping_quote` | Create shipping quote |
| GET | `/shipping_quote/{id}` | Get shipping quote |

### Sell Marketing API v1 — `/sell/marketing/v1`

**75+ endpoints** across 12 resources. Largest eBay API.

#### ad (16 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/ad_campaign/{cid}/bulk_create_ads_by_inventory_reference` | Bulk create ads by SKU |
| POST | `/ad_campaign/{cid}/bulk_create_ads_by_listing_id` | Bulk create ads by listing ID |
| POST | `/ad_campaign/{cid}/bulk_delete_ads_by_inventory_reference` | Bulk delete ads by SKU |
| POST | `/ad_campaign/{cid}/bulk_delete_ads_by_listing_id` | Bulk delete ads by listing ID |
| POST | `/ad_campaign/{cid}/bulk_update_ads_bid_by_inventory_reference` | Bulk update bids by SKU |
| POST | `/ad_campaign/{cid}/bulk_update_ads_bid_by_listing_id` | Bulk update bids by listing ID |
| POST | `/ad_campaign/{cid}/bulk_update_ads_status` | Bulk update CPC ad statuses |
| POST | `/ad_campaign/{cid}/bulk_update_ads_status_by_listing_id` | Bulk update statuses by listing ID |
| POST | `/ad_campaign/{cid}/ad` | Create ad by listing ID |
| POST | `/ad_campaign/{cid}/create_ads_by_inventory_reference` | Create ad by SKU |
| DELETE | `/ad_campaign/{cid}/ad/{ad_id}` | Delete ad |
| POST | `/ad_campaign/{cid}/delete_ads_by_inventory_reference` | Delete ads by SKU |
| GET | `/ad_campaign/{cid}/ad/{ad_id}` | Get ad |
| GET | `/ad_campaign/{cid}/ad` | Search campaign ads |
| GET | `/ad_campaign/{cid}/get_ads_by_inventory_reference` | Get ads by SKU |
| POST | `/ad_campaign/{cid}/ad/{ad_id}/update_bid` | Update CPS ad bid |

#### ad_group (6 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/ad_campaign/{cid}/ad_group` | Create ad group |
| GET | `/ad_campaign/{cid}/ad_group/{gid}` | Get ad group |
| GET | `/ad_campaign/{cid}/ad_group` | Search ad groups |
| POST | `/ad_campaign/{cid}/ad_group/{gid}/suggest_bids` | Get bid suggestions |
| POST | `/ad_campaign/{cid}/ad_group/{gid}/suggest_keywords` | Get keyword suggestions |
| PUT | `/ad_campaign/{cid}/ad_group/{gid}` | Update ad group |

#### campaign (19 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/ad_campaign/{cid}/clone` | Clone ended campaign |
| POST | `/ad_campaign` | Create campaign |
| DELETE | `/ad_campaign/{cid}` | Delete ended campaign |
| POST | `/ad_campaign/{cid}/end` | End active campaign |
| GET | `/ad_campaign/find_campaign_by_ad_reference` | Find campaign by reference |
| GET | `/ad_campaign/{cid}` | Get campaign |
| GET | `/ad_campaign/get_campaign_by_name` | Get campaign by name |
| GET | `/ad_campaign` | Search campaigns |
| POST | `/ad_campaign/{cid}/launch` | Launch draft campaign |
| POST | `/ad_campaign/{cid}/pause` | Pause campaign |
| POST | `/ad_campaign/{cid}/resume` | Resume campaign |
| POST | `/ad_campaign/setup_quick_campaign` | Create quick setup campaign |
| GET | `/ad_campaign/suggest_budget` | Get budget suggestion |
| GET | `/ad_campaign/{cid}/suggest_items` | Get item suggestions |
| POST | `/ad_campaign/suggest_max_cpc` | Get max CPC suggestion |
| POST | `/ad_campaign/{cid}/update_ad_rate_strategy` | Update ad rate strategy |
| POST | `/ad_campaign/{cid}/update_bidding_strategy` | Update bidding strategy |
| POST | `/ad_campaign/{cid}/update_campaign_budget` | Update campaign budget |
| POST | `/ad_campaign/{cid}/update_campaign_identification` | Update campaign name/dates |

#### keyword (6 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/ad_campaign/{cid}/bulk_create_keyword` | Bulk create keywords |
| POST | `/ad_campaign/{cid}/bulk_update_keyword` | Bulk update keywords |
| POST | `/ad_campaign/{cid}/keyword` | Create keyword |
| GET | `/ad_campaign/{cid}/keyword/{kid}` | Get keyword |
| GET | `/ad_campaign/{cid}/keyword` | Search keywords |
| PUT | `/ad_campaign/{cid}/keyword/{kid}` | Update keyword |

#### negative_keyword (6 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/bulk_create_negative_keyword` | Bulk create negative keywords |
| POST | `/bulk_update_negative_keyword` | Bulk update negative keywords |
| POST | `/negative_keyword` | Create negative keyword |
| GET | `/negative_keyword/{nkid}` | Get negative keyword |
| GET | `/negative_keyword` | Search negative keywords |
| PUT | `/negative_keyword/{nkid}` | Update negative keyword |

#### Reporting (4 endpoints)
| Method | Path | Description |
|---|---|---|
| GET | `/ad_report/{id}` | Download Promoted Listings report |
| GET | `/ad_report_metadata` | Get report metadata |
| GET | `/ad_report_metadata/{type}` | Get specific report type metadata |
| POST | `/ad_report_task` | Create report task |
| DELETE | `/ad_report_task/{id}` | Delete report task |
| GET | `/ad_report_task/{id}` | Get report task |
| GET | `/ad_report_task` | Search report tasks |

#### Promotions (12 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/item_price_markdown` | Create markdown discount |
| DELETE | `/item_price_markdown/{id}` | Delete markdown |
| GET | `/item_price_markdown/{id}` | Get markdown |
| PUT | `/item_price_markdown/{id}` | Update markdown |
| POST | `/item_promotion` | Create item discount |
| DELETE | `/item_promotion/{id}` | Delete discount |
| GET | `/item_promotion/{id}` | Get discount |
| PUT | `/item_promotion/{id}` | Update discount |
| GET | `/promotion/{id}/get_listing_set` | Get listings in promotion |
| GET | `/promotion` | Search promotions |
| POST | `/promotion/{id}/pause` | Pause promotion |
| POST | `/promotion/{id}/resume` | Resume promotion |
| GET | `/promotion_report` | Promotion metrics report |
| GET | `/promotion_summary_report` | Summary promotion report |

#### Email Campaign (8 endpoints)
| Method | Path | Description |
|---|---|---|
| POST | `/email_campaign` | Create email campaign |
| DELETE | `/email_campaign/{id}` | Delete email campaign |
| GET | `/email_campaign/audience` | Get audience groups |
| GET | `/email_campaign/{id}` | Get email campaign |
| GET | `/email_campaign` | Search email campaigns |
| GET | `/email_campaign/{id}/email_preview` | Preview email HTML |
| GET | `/email_campaign/report` | Email campaign metrics |
| PUT | `/email_campaign/{id}` | Update email campaign |

### Sell Metadata API v1 — `/sell/metadata/v1`

**22 endpoints** across 3 resources.

#### marketplace
| Method | Path | Description |
|---|---|---|
| GET | `/marketplace/{mid}/get_automotive_parts_compatibility_policies` | Parts compatibility policies |
| GET | `/marketplace/{mid}/get_category_policies` | Category policies |
| GET | `/marketplace/{mid}/get_classified_ad_policies` | Classified ad policies |
| GET | `/marketplace/{mid}/get_currencies` | Default currencies |
| GET | `/marketplace/{mid}/get_extended_producer_responsibility_policies` | EPR policies |
| GET | `/marketplace/{mid}/get_hazardous_materials_labels` | Hazmat labels |
| GET | `/marketplace/{mid}/get_item_condition_policies` | Item condition policies |
| GET | `/marketplace/{mid}/get_listing_structure_policies` | Listing structure policies |
| GET | `/marketplace/{mid}/get_listing_type_policies` | Listing type policies |
| GET | `/marketplace/{mid}/get_motors_listing_policies` | Motors listing policies |
| GET | `/marketplace/{mid}/get_negotiated_price_policies` | Best Offer policies |
| GET | `/marketplace/{mid}/get_product_safety_labels` | Product safety labels |
| GET | `/marketplace/{mid}/get_regulatory_policies` | Regulatory policies |
| GET | `/marketplace/{mid}/get_return_policies` | Return policies |
| GET | `/marketplace/{mid}/get_shipping_policies` | Shipping policies |
| GET | `/marketplace/{mid}/get_site_visibility_policies` | International visibility |

#### compatibilities
| Method | Path | Description |
|---|---|---|
| POST | `/compatibilities/get_compatibilities_by_specification` | Get compatible applications |
| POST | `/compatibilities/get_compatibility_property_names` | Get compatibility property names |
| POST | `/compatibilities/get_compatibility_property_values` | Get compatibility property values |
| POST | `/compatibilities/get_multi_compatibility_property_values` | Get multi-property values |
| POST | `/compatibilities/get_product_compatibilities` | Get product compatibilities |

#### shipping/country
| Method | Path | Description |
|---|---|---|
| GET | `/shipping/marketplace/{mid}/get_exclude_shipping_locations` | Excluded shipping locations |
| GET | `/shipping/marketplace/{mid}/get_handling_times` | Handling times |
| GET | `/shipping/marketplace/{mid}/get_shipping_carriers` | Shipping carriers |
| GET | `/shipping/marketplace/{mid}/get_shipping_locations` | Shipping locations |
| GET | `/shipping/marketplace/{mid}/get_shipping_services` | Shipping services |
| GET | `/country/{code}/sales_tax_jurisdiction` | Sales tax jurisdictions |

### Sell Negotiation API v1 — `/sell/negotiation/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/find_eligible_items` | Find items eligible for seller offers |
| POST | `/send_offer_to_interested_buyers` | Send discounted offers to interested buyers |

### Sell Recommendation API v1 — `/sell/recommendation/v1`

| Method | Path | Description |
|---|---|---|
| POST | `/find` | Get Promoted Listings recommendations for active listings |

### Sell Inventory Mapping API (GraphQL, Limited Release)

Uses GraphQL (not REST). AI-powered recommendations for listing creation from existing product data. US marketplace only.

---

## Commerce APIs (REST)

Base path: `https://api.ebay.com/commerce`

### Catalog API v1_beta — `/commerce/catalog/v1_beta`

| Method | Path | Description |
|---|---|---|
| GET | `/product/{epid}` | Get product by ePID |
| GET | `/product_summary/search` | Search product catalog |

### Charity API v1 — `/commerce/charity/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/charity_org/{id}` | Get charity details |
| GET | `/charity_org` | Search charities |

### Identity API v1 — `/commerce/identity/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/user/` | Get authenticated user profile |

**Scope:** Various `commerce.identity.*` scopes control returned fields.

### Media API v1 — `/commerce/media/v1`

| Method | Path | Description |
|---|---|---|
| POST | `/image/create_image_from_file` | Upload image via multipart |
| POST | `/image/create_image_from_url` | Create image from URL |
| GET | `/image/{image_id}` | Get image details |
| POST | `/video` | Create video metadata |
| GET | `/video/{video_id}` | Get video details |
| POST | `/video/{video_id}/upload` | Upload video file |
| POST | `/document` | Create document metadata |
| POST | `/document/create_document_from_url` | Create document from URL |
| GET | `/document/{document_id}` | Get document details |
| POST | `/document/{document_id}/upload` | Upload document file |

### Notification API v1 — `/commerce/notification/v1`

**19 endpoints** across 5 resources.

#### config
| Method | Path | Description |
|---|---|---|
| GET | `/config` | Get alert email |
| PUT | `/config` | Update alert email |

#### destination
| Method | Path | Description |
|---|---|---|
| POST | `/destination` | Create notification destination |
| GET | `/destination` | Get all destinations |
| GET | `/destination/{id}` | Get destination |
| PUT | `/destination/{id}` | Update destination |
| DELETE | `/destination/{id}` | Delete destination |

#### public_key
| Method | Path | Description |
|---|---|---|
| GET | `/public_key/{id}` | Get validation public key |

#### subscription
| Method | Path | Description |
|---|---|---|
| POST | `/subscription` | Create subscription |
| GET | `/subscription` | Get all subscriptions |
| GET | `/subscription/{id}` | Get subscription |
| PUT | `/subscription/{id}` | Update subscription |
| DELETE | `/subscription/{id}` | Delete subscription |
| POST | `/subscription/{id}/enable` | Enable subscription |
| POST | `/subscription/{id}/disable` | Disable subscription |
| POST | `/subscription/{id}/test` | Send test notification |
| POST | `/subscription/{id}/filter` | Create subscription filter |
| GET | `/subscription/{id}/filter/{fid}` | Get filter |
| DELETE | `/subscription/{id}/filter/{fid}` | Delete filter |

#### topic
| Method | Path | Description |
|---|---|---|
| GET | `/topic` | Get all topics |
| GET | `/topic/{id}` | Get topic details |

### Taxonomy API v1 — `/commerce/taxonomy/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/get_default_category_tree_id` | Get category tree ID for marketplace |
| GET | `/category_tree/{id}` | Get full category hierarchy |
| GET | `/category_tree/{id}/get_category_subtree` | Get category subtree |
| GET | `/category_tree/{id}/get_category_suggestions` | Get category suggestions for query |
| GET | `/category_tree/{id}/get_item_aspects_for_category` | Get item aspects for category |
| GET | `/category_tree/{id}/get_compatibility_properties` | Get compatibility properties |
| GET | `/category_tree/{id}/get_compatibility_property_values` | Get compatibility values |
| GET | `/category_tree/{id}/get_expired_categories` | Get expired category mappings |
| GET | `/category_tree/{id}/fetch_item_aspects` | Get all item aspects for marketplace |

### Translation API v1 — `/commerce/translation/v1`

| Method | Path | Description |
|---|---|---|
| POST | `/translate` | Translate item title or description |

---

## Developer APIs (REST)

Base path: `https://api.ebay.com/developer`

### Developer Analytics API v1 — `/developer/analytics/v1`

| Method | Path | Description |
|---|---|---|
| GET | `/rate_limit/` | Get application-level rate limits/usage |
| GET | `/user_rate_limit/` | Get user-level rate limits/usage |

### Key Management API v1 — `/developer/key_management/v1`

| Method | Path | Description |
|---|---|---|
| POST | `/signing_key` | Create signing key pair |
| GET | `/signing_key/{id}` | Get signing key |
| GET | `/signing_key` | Get all signing keys |

---

## Trading API (Legacy XML/SOAP)

**Endpoint:** `POST https://api.ebay.com/ws/api.dll`

All calls use a single endpoint with the call name specified in the `X-EBAY-API-CALL-NAME` header.

### Buyer-Side Calls (Most Relevant for Watchlist Tool)

| Call | Description |
|---|---|
| **GetMyeBayBuying** | **PRIMARY** — Retrieve watchlist, bid list, won/lost items, favorites |
| **AddToWatchList** | Add items to watchlist (max 400 items) |
| **RemoveFromWatchList** | Remove items from watchlist |
| **GetItem** | Get detailed item information |
| **GetMultipleItems** | Get details for multiple items |
| **PlaceOffer** | Place a bid or Buy It Now |

### Notification Calls
| Call | Description |
|---|---|
| **SetNotificationPreferences** | Subscribe to event notifications |
| **GetNotificationPreferences** | Get notification settings |
| **GetNotificationsUsage** | Get notification delivery stats |

### Other Commonly Used Trading API Calls
| Call | Description |
|---|---|
| **GetUser** | Get user profile info |
| **GetApiAccessRules** | Check API call limits and usage |
| **GetCategories** | Get category tree (deprecated, use Taxonomy API) |
| **GetCategoryFeatures** | Get category features (deprecated) |
| **AddItem** / **ReviseItem** / **EndItem** | Listing management |
| **GetOrders** | Get order details |
| **CompleteSale** | Update order post-sale |
| **GetSellerList** | Get seller's active listings |

---

## Watchlist-Specific Deep Dive

### GetMyeBayBuying — The Only Watchlist Endpoint

**Endpoint:** `POST https://api.ebay.com/ws/api.dll`

**Required Headers:**
```
X-EBAY-API-COMPATIBILITY-LEVEL: 1225
X-EBAY-API-SITEID: 0
X-EBAY-API-CALL-NAME: GetMyeBayBuying
X-EBAY-API-IAF-TOKEN: <oauth_user_token>
Content-Type: text/xml
```

**Minimal request:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<GetMyeBayBuyingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <WatchList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>25</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
    <Sort>EndTime</Sort>
  </WatchList>
</GetMyeBayBuyingRequest>
```

### Request Containers

| Container | Description |
|---|---|
| **WatchList** | Items user is watching |
| **BidList** | Auction items with active bids |
| **WonList** | Won auction items |
| **LostList** | Lost auction items |
| **BestOfferList** | Items with Best Offers |
| **DeletedFromWonList** | Deleted won items |
| **DeletedFromLostList** | Deleted lost items |
| **BuyingSummary** | Activity summary counts |
| **FavoriteSearches** | Saved searches |
| **FavoriteSellers** | Saved sellers |
| **SecondChanceOffer** | Second chance offers |
| **UserDefinedLists** | Custom lists |

### Container Controls

Each container supports:
- **Include** (boolean): Include in response
- **Pagination**: `EntriesPerPage` (default 200), `PageNumber` (starts at 1)
- **Sort**: `ItemSortTypeCodeType` values
- **DurationInDays** (0-60): Filter by recency
- **IncludeNotes** (boolean): Include private/eBay notes
- **ListingType**: Filter by format

### Key Sort Options

| Value | Description |
|---|---|
| `EndTime` / `EndTimeDescending` | Sort by listing end time |
| `TimeLeft` / `TimeLeftDescending` | Sort by time remaining |
| `CurrentPrice` / `CurrentPriceDescending` | Sort by current price |
| `BidCount` / `BidCountDescending` | Sort by bid count |
| `WatchCount` / `WatchCountDescending` | Sort by watcher count |

### Response Fields per WatchList Item

| Field | Description |
|---|---|
| `ItemID` | Unique listing ID |
| `Title` | Listing title |
| `CurrentPrice` | Current price (with currency) |
| `BuyItNowPrice` | Buy It Now price |
| `StartPrice` | Starting price |
| `ListingType` | Auction, FixedPriceItem, etc. |
| `ListingDetails.EndTime` | When listing ends |
| `ListingDetails.ViewItemURL` | Link to item page |
| `TimeLeft` | ISO 8601 duration remaining |
| `SellingStatus.BidCount` | Number of bids |
| `SellingStatus.HighBidder` | Current high bidder |
| `SellingStatus.ReserveMet` | Reserve met status |
| `Seller.UserID` | Seller username |
| `Seller.FeedbackScore` | Seller feedback score |
| `ShippingDetails` | Shipping info |
| `PictureDetails.GalleryURL` | Thumbnail URL |
| `QuantityAvailable` | Remaining quantity |
| `PrivateNotes` | User's private notes |

### Watchlist Limits

- Maximum **400 items** per user watchlist
- `AddToWatchList` response includes `WatchListCount` and `WatchListMaximum`

### Deprecation Status

**GetMyeBayBuying is NOT deprecated** as of February 2025. No REST replacement exists or has been announced. The Trading API is being deprecated call-by-call, not all at once. Buyer-facing calls have no announced deprecation timeline.

---

## Notifications & Webhooks

### A. Platform Notifications (Trading API — Legacy SOAP)

Configured via `SetNotificationPreferences`. Delivered as SOAP XML to your HTTPS endpoint. **Do NOT count against API call limits.**

#### Watchlist-Relevant Events

| Event | Description |
|---|---|
| `ItemAddedToWatchList` | Item added to watchlist |
| `ItemRemovedFromWatchList` | Item removed from watchlist |
| `WatchedItemEndingSoon` | Watched item ending soon (configurable minutes) |
| `BidItemEndingSoon` | Bid item ending soon |
| `OutBid` | User was outbid |
| `BidPlaced` | User placed a bid |
| `ItemWon` | User won auction |
| `ItemLost` | User lost auction |
| `EndOfAuction` | Auction ended |
| `BestOfferDeclined` | Best offer declined |
| `CounterOfferReceived` | Counter offer received |
| `SecondChanceOffer` | Second chance offer |

**WatchedItemEndingSoon configuration:**
```xml
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <UserDeliveryPreferenceArray>
    <NotificationEnable>
      <EventType>WatchedItemEndingSoon</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
  </UserDeliveryPreferenceArray>
  <EventProperty>
    <EventType>WatchedItemEndingSoon</EventType>
    <Name>TimeLeft</Name>
    <Value>15</Value>  <!-- minutes before listing ends -->
  </EventProperty>
</SetNotificationPreferencesRequest>
```

**Requires whitelisting** by eBay Developer Technical Support.

### B. Notification API (REST Webhooks)

Modern webhook system at `/commerce/notification/v1/`.

#### Available Topics

| Topic | Description | Notes |
|---|---|---|
| Authorization Revocation | User revokes app permissions | |
| Buyer Question | Buyer asks about listing | |
| Buyer Requested Purchase Quote | Buyer requests order total | |
| Feedback Left/Received | Feedback events | |
| Item Availability | Item availability changes | **ePN partners only** |
| **Item Price Revision** | Item price changes | **ePN partners only** |
| Item Marked Shipped | Seller marks shipped | |
| Marketplace Account Deletion | Account closure request | |
| New Message | User message received | |
| Order Confirmation | Checkout completed | |
| PLA Campaign Budget Status | Promoted Listings budget exhausted | |
| Offer Activity | Offer activity for buyers/sellers | Added Q4 2025 |
| Auction Activity | Auction activity notifications | Added Q4 2025 |
| Listing Preview Creation Task Status | Inventory Mapping API task done | |

**Key limitation:** No watchlist topics in the REST Notification API. `WatchedItemEndingSoon` and watchlist add/remove events are Trading API Platform Notifications only.

---

## SDKs & Libraries

### Official eBay SDKs

| SDK | Language | Purpose |
|---|---|---|
| OAuth Client Library | Node.js, Python, C#, Android | Token generation and refresh |
| Event Notification SDK | Node.js, Java, .NET, PHP, Go | Webhook listener/verification |
| Digital Signature SDK | Node.js, Java | API request signing |
| Buy Feed SDK | Java, Python | Feed data processing |
| Trading API SDK | .NET, Java | Trading API helpers |

### Recommended Community Library

**[ebay-api](https://www.npmjs.com/package/ebay-api)** (by hendt) — Node.js/TypeScript

- Covers both REST and XML/Trading APIs
- Built-in OAuth token management with auto-refresh
- Digital signature support
- Actively maintained
- Best choice for a Node.js watchlist monitoring tool

---

## Architecture Recommendations

### Recommended Stack for Watchlist Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    Watchlist Monitor                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. INITIAL SYNC                                            │
│     Trading API: GetMyeBayBuying                            │
│     → Retrieve full watchlist with pagination                │
│     → Store item IDs, prices, end times locally              │
│                                                             │
│  2. REAL-TIME EVENTS                                        │
│     Trading API: Platform Notifications                      │
│     → ItemAddedToWatchList    → update local list            │
│     → ItemRemovedFromWatchList → update local list           │
│     → WatchedItemEndingSoon   → trigger alert                │
│                                                             │
│  3. PERIODIC POLL (every 5-15 min)                          │
│     Trading API: GetMyeBayBuying                             │
│     → Detect price changes (compare stored vs current)       │
│     → Catch missed notifications                             │
│     → Full state sync                                        │
│                                                             │
│  4. ITEM ENRICHMENT                                         │
│     Browse API: GET /buy/browse/v1/item/                     │
│     → Batch get up to 20 items per call                      │
│     → Rich JSON details, images, condition                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Constraints

- Trading API (XML/SOAP) is the **only** way to access a user's personal watchlist
- Max 400 items per watchlist
- OAuth **User token** required (authorization code grant)
- Default 5,000 Trading API calls/day (request increase for production)
- Platform Notifications are free (no API call count impact) but require whitelisting
- Using Browse API `getItems` with 20-item batching: 5,000 calls/day = 100,000 item checks/day

### Auth Flow for Personal Tool

1. Register at [developer.ebay.com/join](https://developer.ebay.com/join) (free)
2. Create production keyset (App ID, Dev ID, Cert ID)
3. Build OAuth consent flow (one-time user authorization)
4. Store refresh token (~18 month lifetime)
5. Auto-refresh access tokens (2-hour lifetime)

---

## Endpoint Count Summary

| API Family | API | Endpoints |
|---|---|---|
| **Buy** | Browse | 7 |
| | Deal | 4 |
| | Feed | 4 |
| | Marketing | 1 |
| | Marketplace Insights | 1 |
| | Offer | 2 |
| | Order | 8 |
| **Sell** | Account | 43 |
| | Analytics | 4 |
| | Compliance | 2 (deprecated) |
| | Feed | 22 |
| | Finances | 8 |
| | Fulfillment | 15 |
| | Inventory | 36 |
| | Listing | 1 |
| | Logistics | 6 |
| | Marketing | 75+ |
| | Metadata | 27 |
| | Negotiation | 2 |
| | Recommendation | 1 |
| **Commerce** | Catalog | 2 |
| | Charity | 2 |
| | Identity | 1 |
| | Media | 10 |
| | Notification | 21 |
| | Taxonomy | 9 |
| | Translation | 1 |
| **Developer** | Analytics | 2 |
| | Key Management | 3 |
| **Trading** | (Legacy XML) | 100+ calls |
| **TOTAL** | | **~320+ REST endpoints + 100+ Trading API calls** |
