# Shopify Data Extraction Scripts

Scripts to pull MonsterBass Shopify data via the Admin API for the financial audit.

## Prerequisites

- Python 3.9+
- `requests` library (already installed)
- Shopify store admin access

## Setup (5 minutes)

### 1. Create a Custom App in Shopify

1. Go to **Shopify Admin → Settings → Apps and sales channels**
2. Click **Develop apps** (you may need to enable developer preview first)
3. Click **Create an app** → name it `MonsterBass Audit`
4. Go to **Configuration → Admin API integration**
5. Select these scopes:

| Scope | Purpose |
|-------|---------|
| `read_orders` | Orders, line items, transactions |
| `read_all_orders` | Access orders older than 60 days * |
| `read_products` | Product catalog and variants |
| `read_customers` | Customer profiles |
| `read_shopify_payments_payouts` | Payout records for bank reconciliation |
| `read_shopify_payments_disputes` | Dispute/chargeback data |
| `read_inventory` | Inventory levels |
| `read_returns` | Return records |

6. Click **Save** then **Install app**
7. Copy the **Admin API access token** (shown once — save it)

> \* **read_all_orders note**: For custom apps created in the admin, this scope
> is typically available in the scopes list. If it's not listed, the script will
> still work but only return orders from the last 60 days. In that case, use the
> manual CSV export from Shopify Admin → Orders → Export as a fallback for
> historical orders. You can also email `read-all-orders-request@shopify.com`
> to request access.

### 2. Configure the Script

Edit `scripts/config.py`:

```python
SHOP_NAME = "your-store"        # the part before .myshopify.com
ACCESS_TOKEN = "shpat_xxxxx"    # your Admin API access token
```

### 3. Test the Connection

```bash
python3 scripts/shopify_extract.py --test
```

Expected output:
```
Testing API connection...
  Connected to: MonsterBass
  Domain: monsterbass.myshopify.com
  Plan: Basic Shopify
  Currency: USD
Connection successful.
```

## Running the Extraction

### Full extraction (all data)

```bash
python3 scripts/shopify_extract.py
```

This runs 4 bulk operations sequentially:
1. **orders** — All orders Jan 2024–Dec 2025 with line items, refunds, transactions
2. **products** — Full product catalog with variants/SKUs
3. **customers** — Customer profiles with order counts and spend
4. **payouts** — Shopify Payments payout records for bank reconciliation

Each bulk operation runs server-side on Shopify and can take 1–15 minutes depending on data volume. Total runtime is typically 10–30 minutes.

### Single extraction

```bash
python3 scripts/shopify_extract.py orders
python3 scripts/shopify_extract.py products
python3 scripts/shopify_extract.py payouts
```

### Re-convert existing JSONL without re-downloading

```bash
python3 scripts/shopify_extract.py --convert-only
```

## Output Files

### Raw data (`shopify_raw/`)

JSONL files exactly as returned by Shopify's Bulk Operations API.

| File | Contents |
|------|----------|
| `orders.jsonl` | Orders with nested line items, refunds, transactions |
| `products.jsonl` | Products with nested variants |
| `customers.jsonl` | Customer records |
| `payouts.jsonl` | Shopify Payments payout records |

### Cleaned CSVs (`shopify_cleaned/`)

| File | Rows | Purpose |
|------|------|---------|
| `orders_summary.csv` | 1 per order | Order-level financial totals |
| `order_line_items.csv` | 1 per SKU per order | SKU-level revenue for margin analysis |
| `refunds_detail.csv` | 1 per refund line | Refund breakdown by SKU |
| `monthly_shopify_revenue.csv` | 1 per month | Monthly aggregates (cross-ref with QBO) |
| `sku_revenue_summary.csv` | 1 per SKU | Revenue ranked by SKU for margin analysis |
| `products_catalog.csv` | 1 per variant | Full product/variant/SKU catalog |
| `customers.csv` | 1 per customer | Customer profiles with spend data |
| `payouts.csv` | 1 per payout | Individual payout records |
| `monthly_payouts.csv` | 1 per month | Monthly payout aggregates |
| `shopify_qbo_reconciliation.csv` | 1 per month | **Shopify vs QBO variance analysis** |

## How These Files Plug Into the Audit

### Revenue Reconciliation (was blocked)

`shopify_qbo_reconciliation.csv` directly compares:
- **Shopify net revenue** (from orders) vs **QBO Shopify revenue** (from `monthly_revenue_by_channel.csv`)
- **Shopify payout deposits** vs **QBO deposits**
- Computes variance for each month

Expected variances come from:
- Timing differences (order date vs deposit date)
- Shopify fees deducted before payout
- Shopify Capital daily withholdings

### SKU-Level Margin Analysis (was blocked)

1. `sku_revenue_summary.csv` gives revenue per SKU from Shopify
2. Legacy books (`cleaned/monsterbass_legacy/general_ledger.csv`) have unit costs per SKU
3. Join on SKU/barcode to compute per-product margins

### Refund/Return Rate Analysis (was blocked)

`refunds_detail.csv` breaks down every refund by SKU and amount, enabling:
- Return rate by product
- True net revenue after returns
- Monthly refund trends

### Customer Metrics (was blocked)

`customers.csv` enables:
- Customer cohort analysis by signup date
- Revenue concentration (top customers)
- Geographic distribution
- Repeat purchase rates

## What's NOT Available via API

**Shopify Capital loan details** have no API endpoint. You must manually record these from **Shopify Admin → Finance → Capital**:

- [ ] Factor rate (total cost of capital)
- [ ] Total repayment amount
- [ ] Daily withholding percentage
- [ ] Projected payoff date
- [ ] Prepayment options/penalties
- [ ] Transaction history (screenshot or manual export)

This answers Question #7 from `Master_Questions_List.md`.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Bad access token | Re-copy token from Shopify admin |
| `403 Forbidden` | Missing scope | Add the required scope in app config, reinstall |
| `THROTTLED` | Rate limited | Script handles this via bulk operations (no rate limits) |
| `ACCESS_DENIED` on bulk op | Scope not granted | Check app has the correct scopes installed |
| Only recent orders returned | Missing `read_all_orders` | See note above about requesting this scope |
| Payouts query fails | Not using Shopify Payments | Payouts only work if Shopify Payments is active |
| Empty JSONL file | No data in date range | Verify AUDIT_START/AUDIT_END in config.py |

## File Structure After Running

```
monsterbass/
├── scripts/
│   ├── config.py              ← Your credentials (DO NOT COMMIT)
│   ├── shopify_extract.py     ← Main extraction script
│   └── README.md              ← This file
├── shopify_raw/               ← Raw JSONL from Shopify API
│   ├── orders.jsonl
│   ├── products.jsonl
│   ├── customers.jsonl
│   └── payouts.jsonl
├── shopify_cleaned/           ← Audit-ready CSVs
│   ├── orders_summary.csv
│   ├── order_line_items.csv
│   ├── refunds_detail.csv
│   ├── monthly_shopify_revenue.csv
│   ├── sku_revenue_summary.csv
│   ├── products_catalog.csv
│   ├── customers.csv
│   ├── payouts.csv
│   ├── monthly_payouts.csv
│   └── shopify_qbo_reconciliation.csv
├── cleaned/                   ← Existing QBO data
├── output/                    ← Existing audit reports
└── AUDIT_GUIDE.md
```
