# MonsterBass Phase 2: Shopify Data Analysis

**Report Date:** February 05, 2026
**Data Source:** Shopify Admin API + QBO Financial Data
**Audit Period:** January 2024 - December 2025

---

## Revenue Reconciliation


**Period:** 2024-01 to 2026-01

## Totals

| Metric | Amount |
|--------|--------|
| Shopify Gross Revenue | $3,804,779.27 |
| Shopify Net Revenue | $3,699,456.81 |
| QBO Shopify Revenue | $2,516,306.83 |
| **Revenue Variance** | **$1,183,149.98** |
| Shopify Payouts | $2,479,663.79 |
| QBO Shopify Deposits | $5,199,358.28 |
| **Deposit Variance** | **$-2,719,694.49** |

## Material Variances (>$1,000)

| Month | Variance | Type |
|-------|----------|------|
| 2024-01 | $52,920.58 | net vs QBO revenue |
| 2024-01 | $-96,364.35 | payout vs QBO deposits |
| 2024-02 | $60,467.73 | net vs QBO revenue |
| 2024-02 | $-105,660.71 | payout vs QBO deposits |
| 2024-03 | $73,025.15 | net vs QBO revenue |
| 2024-03 | $-127,875.64 | payout vs QBO deposits |
| 2024-04 | $52,322.74 | net vs QBO revenue |
| 2024-04 | $-126,877.33 | payout vs QBO deposits |
| 2024-05 | $65,017.92 | net vs QBO revenue |
| 2024-05 | $-107,622.69 | payout vs QBO deposits |
| 2024-06 | $65,525.03 | net vs QBO revenue |
| 2024-06 | $-120,226.24 | payout vs QBO deposits |
| 2024-07 | $44,195.71 | net vs QBO revenue |
| 2024-07 | $-109,171.12 | payout vs QBO deposits |
| 2024-08 | $53,342.70 | net vs QBO revenue |
| 2024-08 | $-83,686.69 | payout vs QBO deposits |
| 2024-09 | $50,705.57 | net vs QBO revenue |
| 2024-09 | $-101,332.41 | payout vs QBO deposits |
| 2024-10 | $37,545.53 | net vs QBO revenue |
| 2024-10 | $-84,970.53 | payout vs QBO deposits |
| 2024-11 | $40,170.11 | net vs QBO revenue |
| 2024-11 | $-115,833.10 | payout vs QBO deposits |
| 2024-12 | $61,842.99 | net vs QBO revenue |
| 2024-12 | $-69,941.98 | payout vs QBO deposits |
| 2025-01 | $38,269.13 | net vs QBO revenue |
| 2025-01 | $-75,682.08 | payout vs QBO deposits |
| 2025-02 | $33,812.53 | net vs QBO revenue |
| 2025-02 | $-80,010.01 | payout vs QBO deposits |
| 2025-03 | $42,204.20 | net vs QBO revenue |
| 2025-03 | $-129,274.16 | payout vs QBO deposits |
| 2025-04 | $42,668.22 | net vs QBO revenue |
| 2025-04 | $-105,839.04 | payout vs QBO deposits |
| 2025-05 | $59,799.79 | net vs QBO revenue |
| 2025-05 | $-98,034.08 | payout vs QBO deposits |
| 2025-06 | $56,875.34 | net vs QBO revenue |
| 2025-06 | $-123,309.16 | payout vs QBO deposits |
| 2025-07 | $21,146.62 | net vs QBO revenue |
| 2025-07 | $-123,431.09 | payout vs QBO deposits |
| 2025-08 | $28,960.64 | net vs QBO revenue |
| 2025-08 | $-109,040.69 | payout vs QBO deposits |
| 2025-09 | $37,492.10 | net vs QBO revenue |
| 2025-09 | $-351,809.15 | payout vs QBO deposits |
| 2025-10 | $39,458.42 | net vs QBO revenue |
| 2025-10 | $-69,435.21 | payout vs QBO deposits |
| 2025-11 | $61,289.43 | net vs QBO revenue |
| 2025-11 | $-111,332.88 | payout vs QBO deposits |
| 2025-12 | $63,744.34 | net vs QBO revenue |
| 2025-12 | $-92,934.15 | payout vs QBO deposits |

## Expected Variance Sources

- **Timing differences**: Order date vs deposit date (1-3 business days)
- **Shopify fees**: Processing fees deducted before payout
- **Shopify Capital**: Daily auto-withdrawals from payouts (~$500-700/day)
- **Chargebacks/disputes**: Deducted from payouts, may not match QBO timing
- **Currency rounding**: Minor differences from rounding

## Reconciliation Status

Variance is 47.0% of QBO revenue — **investigation required**.


---

## SKU-Level Margin Analysis


## Overview

| Metric | Value |
|--------|-------|
| Total Shopify Revenue | $3,873,650.35 |
| Matched to Cost Data | $169,047.50 (4.4%) |
| Unmatched Revenue | $3,704,602.85 |
| Total COGS (matched) | $8,194,194.37 |
| **Blended Gross Margin** | **-111.5%** |
| SKUs Matched | 244 |
| SKUs Unmatched | 2453 |

## Top 10 Products by Revenue

| Product | Revenue | COGS | Margin | Margin % |
|---------|---------|------|--------|----------|
| Create A Bait - Kid's Fishing Kit | $18,856.71 | $207,000.00 | $-188,143.29 | -997.8% |
| SILVER | $16,972.52 | $157,890.00 | $-140,917.48 | -830.3% |
| Kid's Create a Bait Fishing Kit - Fun Si | $13,344.82 | $86,625.00 | $-73,280.18 | -549.1% |
| Kid's Create a Bait Fishing Kit - Super  | $6,659.70 | $25,200.00 | $-18,540.30 | -278.4% |
| LUNKERSTICK™ - BFS Series - Ultra-Finess | $5,518.80 | $99,264.00 | $-93,745.20 | -1698.7% |
| LUNKERSTICK™ - BFS Series - Finesse | $5,518.80 | $99,960.00 | $-94,441.20 | -1711.3% |
| The Vault | 3600, 3700, Spinnerbait, Cra | $4,051.50 | $641,300.00 | $-637,248.50 | -15728.7% |
| Death Rattle Lipless Crankbait - Gold Bl | $2,376.00 | $161,568.00 | $-159,192.00 | -6700.0% |
| Death Rattle Lipless Crankbait - Chrome  | $2,356.16 | $160,344.00 | $-157,987.84 | -6705.3% |
| Dirty Dancer - Baby Bass | $2,098.49 | $40,090.00 | $-37,991.51 | -1810.4% |

## Lowest Margin Products (potential losers)

| Product | Revenue | Margin % | Unit Cost |
|---------|---------|----------|----------|
| New MONSTERBASS Bait Bags | $15.98 | -95557.1% | $7,643.00 |
| Dynamic Lures J-Spec Jerkbait | $910.85 | -62396.6% | $4,950.00 |
| Ultimate Frog - Tan/Brown | $1,961.49 | -48918.0% | $6,367.44 |
| Ultimate Frog - Green/Yellow | $376.71 | -48918.0% | $6,367.44 |
| Heavy Hitt'R | $26.97 | -47452.8% | $4,275.00 |
| Hendrix Fishing Voodoo Frog - Limited Ed | $1,434.45 | -37525.6% | $4,120.00 |
| Patriotic Bass | $188.00 | -31400.0% | $630.00 |
| Mini D Chunk | $65.66 | -26919.2% | $1,267.20 |
| Craw Father | $89.11 | -24217.3% | $1,140.48 |
| Quiver 6.5 | $14.07 | -20164.4% | $950.40 |

## Highest Margin Products

| Product | Revenue | Margin % | Unit Cost |
|---------|---------|----------|----------|
| Smoke X 100 Hpt LH Baitcast Reel 8+1 | $574.94 | -106.6% | $198.00 |
| Kid's Create a Bait Fishing Kit - Super  | $6,659.70 | -278.4% | $225.00 |
| Seeker 8 - Green Sexy | $115.88 | -303.9% | $36.00 |
| Seeker 8 - Crawlicious | $61.94 | -306.8% | $36.00 |
| Seeker 8 - Crawlicious | $524.21 | -312.0% | $36.00 |
| Seeker 8 - Bone | $434.31 | -314.5% | $36.00 |
| Seeker 8 - Blackout | $416.82 | -314.6% | $36.00 |
| Seeker 8 - Green Sexy | $416.82 | -314.6% | $36.00 |
| Seeker 8 - Bone | $155.88 | -315.7% | $36.00 |
| Seeker 8 - Threadfin Shad | $609.81 | -319.1% | $36.00 |

## Unmatched SKUs (top by revenue)

These products have Shopify revenue but no matching cost data in legacy books.

| Product | SKU | Revenue |
|---------|-----|--------|
| Platinum: South: monthly | mb-subscription-south-1 | $169,421.68 |
| Platinum Series Northeast: monthly | mb-subscription-northeast-1 | $128,439.67 |
| Platinum Series Midwest: monthly | mb-subscription-greatlakes-1 | $97,529.85 |
| Platinum: South: 3 month | mb-subscription-south-3 | $96,777.00 |
| Platinum Series Midwest: 3 month | mb-subscription-greatlakes-3 | $85,192.00 |
| Platinum Series Northeast: 3 month | mb-subscription-northeast-3 | $83,238.95 |
| Platinum Series: 3 month | PLATINUM-NEW-3 | $78,006.29 |
| Platinum Series: monthly | PLATINUM-NEW | $77,953.59 |
| Platinum Series: 12 month | PLATINUM-NEW-12 | $70,525.95 |
| Platinum Series: 6 month | PLATINUM-NEW-6 | $49,303.95 |
| Platinum Series South: 12 month | mb-subscription-south-12 | $48,706.00 |
| Gold Series: 6 month | GOLD-NEW | $48,222.10 |
| Platinum Series Northeast: 6 month | mb-subscription-northeast-6 | $46,793.00 |
| Platinum Series West: monthly | mb-subscription-psw-1 | $46,004.16 |
| Platinum - Bass Monthly: June 2025 | platinum-0625 | $45,884.07 |


---

## Refund & Return Analysis


## Overview

| Metric | Value |
|--------|-------|
| Total Orders | 101,126 |
| Orders with Refunds | 1,143 |
| **Refund Rate** | **1.1%** |
| Total Revenue | $3,804,779.27 |
| Total Refunded | $92,195.86 |
| **Refund % of Revenue** | **2.4%** |
| Net Revenue | $3,712,583.41 |

## Most Refunded Products

| SKU | Refund Count | Refund Amount | Units Returned |
|-----|-------------|---------------|---------------|
|  | 1753 | $0.00 | 0 |


---

## Customer Analysis


## Overview

| Metric | Value |
|--------|-------|
| Total Unique Customers | 19,176 |
| One-Time Buyers | 8,006 (41.8%) |
| Repeat Customers | 11,170 (58.2%) |
| Average Revenue per Customer | $198.41 |
| **Top 10% Revenue Concentration** | **44.6%** |
| **Top 20% Revenue Concentration** | **65.4%** |

## Top 15 Customers by Revenue

| Email | Revenue | Orders | First Order | Last Order |
|-------|---------|--------|-------------|------------|
| sg@warriorstacklesupply.com | $11,442.56 | 6 | 2024-01-16 | 2024-07-05 |
| anonymous | $9,965.49 | 244 | 2024-03-19 | 2025-12-28 |
| rsdial92@hotmail.com | $9,368.70 | 10 | 2024-01-10 | 2025-12-31 |
| tylor@hendrixfishing.com | $6,503.42 | 12 | 2024-06-24 | 2025-05-28 |
| LarryVidaurri@gmail.com | $5,468.78 | 11 | 2025-04-28 | 2025-08-26 |
| chunkchasersbaitandtackle@gmail.com | $5,415.64 | 10 | 2025-06-30 | 2025-11-06 |
| docroyse@gmail.com | $4,101.55 | 98 | 2024-01-02 | 2025-12-02 |
| andreshorta0@gmail.com | $3,954.07 | 85 | 2025-11-28 | 2025-12-03 |
| jenkinswill104@gmail.com | $3,719.22 | 47 | 2024-07-26 | 2025-12-02 |
| vic.sookazian@gmail.com | $3,543.29 | 2 | 2025-11-22 | 2025-11-25 |
| brianjrand77@gmail.com | $3,094.51 | 138 | 2024-01-03 | 2025-12-19 |
| peoplesbri@yahoo.com | $2,723.20 | 116 | 2024-01-03 | 2025-12-19 |
| basshog1965@gmail.com | $2,516.34 | 98 | 2024-01-11 | 2025-12-11 |
| russ.vaniderstine@gmail.com | $2,484.81 | 36 | 2024-01-09 | 2024-09-01 |
| steelers3737@gmail.com | $2,429.07 | 41 | 2024-04-13 | 2025-12-11 |


---

## Data Files Generated

| File | Location |
|------|----------|
| customer_cohorts.csv | `output/shopify_analysis/customer_cohorts.csv` |
| customer_concentration.csv | `output/shopify_analysis/customer_concentration.csv` |
| customer_summary.md | `output/shopify_analysis/customer_summary.md` |
| margin_summary.md | `output/shopify_analysis/margin_summary.md` |
| monthly_refunds.csv | `output/shopify_analysis/monthly_refunds.csv` |
| product_performance.csv | `output/shopify_analysis/product_performance.csv` |
| reconciliation_summary.md | `output/shopify_analysis/reconciliation_summary.md` |
| refund_summary.md | `output/shopify_analysis/refund_summary.md` |
| revenue_by_product_type.csv | `output/shopify_analysis/revenue_by_product_type.csv` |
| revenue_reconciliation.csv | `output/shopify_analysis/revenue_reconciliation.csv` |
| sku_margins.csv | `output/shopify_analysis/sku_margins.csv` |
| sku_unmatched.csv | `output/shopify_analysis/sku_unmatched.csv` |
