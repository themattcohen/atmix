# MonsterBass (Outdoor Playground Inc) -- Customer & Revenue Deep Dive

**Prepared for CEO Presentation | Data through December 31, 2025**

---

## Executive Summary

| Metric | Value | Signal |
|--------|-------|--------|
| Total Revenue (net) | $3,689,491 | 2-year dataset (Jan 2024 - Dec 2025) |
| Total Customers (ordering) | 19,175 | Out of 258K in Shopify DB (7.4% conversion) |
| Active Last 90 Days | 5,174 | 27% of all ordering customers |
| Active Subscribers (60d) | 2,699 | Core recurring revenue base |
| Average LTV | $192.41 | Median $81.98 -- heavy right skew |
| Repeat Purchase Rate | 58.2% | Repeat buyers drive 90.7% of revenue |
| Subscription Revenue Share | 74.4% | Business is fundamentally subscription-driven |
| Refund Rate | 2.42% of revenue | Low and improving in 2025 |
| YoY Revenue (2024 vs 2025) | -11.4% | Declining but stabilizing in H2 2025 |
| TikTok Shop (Nov-Dec 2025) | $39,077 / 927 orders | Emerging channel -- 41.5% of new Nov-Dec customers |

**The critical story:** Revenue declined 11.4% YoY because the massive Jan 2024 founding cohort (4,697 customers) is steadily churning. The business has not yet replaced them at scale. However, Q4 2025 shows a reversal pattern driven by TikTok Shop and holiday acquisition. The subscription engine is strong (74% of revenue, 58% repeat rate), but the top of funnel must expand.

---

## 1. Lifetime Value Analysis

### LTV Distribution

| Percentile | LTV |
|------------|-----|
| P10 | $10.48 |
| P25 | $33.30 |
| P50 (Median) | $81.98 |
| P75 | $247.56 |
| P90 | $524.54 |
| P95 | $777.63 |
| P99 | $1,143.24 |

**Insight:** The gap between mean ($192) and median ($82) reveals a power-law distribution. The top 10% of customers ($524+ LTV) generate 44.9% of all revenue. Strategy should protect these whales while lifting the median.

### LTV by Acquisition Cohort

| Cohort | Customers | Avg LTV | Median LTV | Avg Orders | Avg Tenure |
|--------|-----------|---------|------------|------------|------------|
| **2024-01** | **4,697** | **$329.43** | **$180.21** | **10.5** | **272 days** |
| 2024-02 | 598 | $242.66 | $126.25 | 6.3 | 172 days |
| 2024-03 | 752 | $200.88 | $101.04 | 5.4 | 148 days |
| 2024-04 | 643 | $221.54 | $124.91 | 5.7 | 147 days |
| 2024-05 | 496 | $208.43 | $122.02 | 4.7 | 125 days |
| 2024-06 | 764 | $175.79 | $90.44 | 4.2 | 98 days |
| 2024-07 | 565 | $173.65 | $70.01 | 4.1 | 100 days |
| 2024-08 | 564 | $147.46 | $60.80 | 3.6 | 84 days |
| 2024-09 | 576 | $157.21 | $55.95 | 4.0 | 94 days |
| 2024-10 | 332 | $161.02 | $73.12 | 4.1 | 91 days |
| 2024-11 | 468 | $160.85 | $65.06 | 3.9 | 95 days |
| 2024-12 | 774 | $128.47 | $50.48 | 3.4 | 72 days |
| **2025-01** | **318** | **$194.09** | **$127.31** | **4.8** | **111 days** |
| 2025-02 | 542 | $154.10 | $90.35 | 4.2 | 86 days |
| 2025-03 | 859 | $160.62 | $93.57 | 4.0 | 78 days |
| 2025-04 | 626 | $163.87 | $101.25 | 3.9 | 76 days |
| 2025-05 | 810 | $134.49 | $68.30 | 3.4 | 64 days |
| 2025-06 | 728 | $144.59 | $88.03 | 3.3 | 56 days |
| 2025-07 | 634 | $128.01 | $69.57 | 3.0 | 48 days |
| 2025-08 | 427 | $131.83 | $85.36 | 2.9 | 45 days |
| 2025-09 | 463 | $86.81 | $38.86 | 2.2 | 27 days |
| 2025-10 | 409 | $87.16 | $58.47 | 1.9 | 22 days |
| 2025-11 | 1,023 | $70.29 | $39.58 | 1.4 | 5 days |
| 2025-12 | 1,100 | $73.00 | $40.28 | 1.1 | 0 days |

**Key takeaway:** The Jan 2024 cohort is disproportionately valuable ($329 avg LTV, 10.5 orders each). This was likely the subscription launch or migration cohort. Post-launch cohorts stabilize around $150-$200 LTV when given 6+ months to mature. Recent cohorts (Q4 2025) are too young to judge but show promising volume.

### LTV Trajectory: How Revenue Per Customer Grows Over Time

This table shows cumulative revenue per customer at each month after acquisition:

| Months After Acq. | Jan-24 | Apr-24 | Jul-24 | Oct-24 | Jan-25 | Apr-25 | Jul-25 |
|-------------------|--------|--------|--------|--------|--------|--------|--------|
| Month 0 | $32.79 | $93.86 | $65.53 | $69.84 | $90.47 | $78.90 | $73.63 |
| Month 1 | $58.05 | $108.93 | $81.57 | $83.21 | $105.24 | $100.95 | $88.84 |
| Month 2 | $87.16 | $119.92 | $95.06 | $94.42 | $117.25 | $116.37 | $99.50 |
| Month 3 | $109.32 | $141.60 | $110.63 | $108.69 | $133.86 | $133.16 | $113.76 |
| Month 6 | $169.27 | $167.75 | $133.98 | $132.56 | $165.73 | $157.27 | $128.01 |
| Month 9 | $209.43 | $182.65 | $147.52 | $143.71 | $186.37 | -- | -- |
| Month 12 | $247.26 | $199.15 | $161.63 | $156.19 | $194.09 | -- | -- |

**Insight:** Customers continue generating revenue well past month 6. The Jan 2025 cohort is tracking above the Apr/Jul 2024 cohorts at equivalent maturity -- a positive signal. On average, a retained customer adds ~$10-15/month in LTV after the first month.

---

## 2. Retention & Churn

### Cohort Retention (% of customers ordering again at month N)

| Cohort | M1 | M2 | M3 | M6 | M9 | M12 |
|--------|-----|-----|-----|-----|-----|------|
| **2024-01** | **83.9%** | **74.7%** | **68.2%** | **48.4%** | **36.3%** | **28.3%** |
| 2024-02 | 52.3% | 46.8% | 37.1% | 25.6% | 18.6% | 14.4% |
| 2024-03 | 51.2% | 43.1% | 35.4% | 21.5% | 15.0% | 12.1% |
| 2024-04 | 51.9% | 48.8% | 40.6% | 22.2% | 16.0% | 12.3% |
| 2024-06 | 44.9% | 39.3% | 27.2% | 14.8% | 10.1% | 6.7% |
| 2024-09 | 38.2% | 31.6% | 24.5% | 14.4% | 13.2% | 7.6% |
| 2024-12 | 32.7% | 25.7% | 21.7% | 13.7% | 9.7% | 5.6% |
| **2025-01** | **48.4%** | **44.3%** | **39.3%** | **24.2%** | **19.8%** | -- |
| 2025-03 | 54.5% | 42.5% | 31.9% | 16.9% | 9.3% | -- |
| 2025-04 | 55.1% | 45.4% | 34.2% | 17.4% | -- | -- |
| 2025-06 | 48.9% | 40.8% | 27.7% | 13.9% | -- | -- |

**Critical finding:** Excluding the anomalous Jan 2024 cohort, the typical M1 retention is 45-55%, falling to 20-25% at M6 and 10-15% at M12. The Jan 2025 cohort shows improvement (48.4% M1, 19.8% M9), possibly from better onboarding or targeting. The biggest retention drop-off is between M1 and M3 -- this is where churn intervention yields the highest ROI.

### Month-over-Month Active Customer Retention

| Period | Active Custs | Retained Next Month | Retention Rate | Lost | Net New |
|--------|-------------|--------------------:|---------------:|-----:|--------:|
| Jan 2024 | 4,697 | 3,942 | 83.9% | 755 | 598 |
| Mar 2024 | 4,575 | 3,788 | 82.8% | 787 | 725 |
| Jun 2024 | 4,280 | 3,379 | 78.9% | 901 | 696 |
| Sep 2024 | 3,631 | 2,753 | 75.8% | 878 | 485 |
| Dec 2024 | 3,400 | 2,433 | 71.6% | 967 | 447 |
| Mar 2025 | 3,395 | 2,578 | 75.9% | 817 | 916 |
| Jun 2025 | 3,620 | 2,746 | 75.9% | 874 | 805 |
| Sep 2025 | 3,059 | 2,280 | 74.5% | 779 | 600 |
| Nov 2025 | 3,347 | 1,934 | 57.8% | 1,413 | 1,243 |

**Trend:** MoM retention has declined from ~84% in early 2024 to a steady ~75% through mid-2025. The Nov 2025 dip to 57.8% likely reflects seasonal one-time buyers who did not return in Dec. The core subscription base holds at roughly 75% monthly retention.

### Customer Order Frequency

| Segment | Customers | % of Total | Revenue | % of Revenue |
|---------|-----------|-----------|---------|-------------|
| 1 order only | 8,006 | 41.8% | $343,710 | 9.3% |
| 2+ orders | 11,169 | 58.2% | $3,345,781 | 90.7% |
| 3+ orders | 9,057 | 47.2% | -- | -- |
| 6+ orders | 5,643 | 29.4% | -- | -- |
| 12+ orders | 2,506 | 13.1% | -- | -- |

**The 58/91 rule:** 58% of customers (repeat buyers) generate 91% of revenue. Converting even 10% of single-order buyers into repeaters would add roughly $34K in additional revenue.

### Subscription vs One-Time Orders

| Type | Orders | Revenue | Avg Order Value |
|------|--------|---------|-----------------|
| Subscription | 79,428 (78.5%) | $2,941,443 (79.5%) | $37.03 |
| One-Time Purchase | 21,698 (21.5%) | $758,013 (20.5%) | $34.93 |

Of subscription orders: 20,364 are first orders (25.6%) and 59,064 are recurring (74.4%).

---

## 3. Revenue Trends & Seasonality

### Monthly Revenue Trend

| Month | Revenue | Orders | Customers | AOV | MoM Change |
|-------|---------|--------|-----------|-----|------------|
| Jan 2024 | $154,018 | 5,183 | 4,697 | $29.72 | -- |
| Feb 2024 | $167,870 | 5,096 | 4,540 | $32.94 | +9.0% |
| Mar 2024 | $201,389 | 5,357 | 4,574 | $37.59 | +20.0% |
| Jun 2024 | $191,453 | 4,928 | 4,280 | $38.85 | -- |
| Sep 2024 | $153,982 | 4,092 | 3,631 | $37.63 | -- |
| Dec 2024 | $165,436 | 3,968 | 3,399 | $41.69 | -- |
| Jan 2025 | $117,918 | 3,346 | 2,879 | $35.24 | -28.7% |
| Mar 2025 | $160,920 | 3,938 | 3,394 | $40.86 | -- |
| Jun 2025 | $182,799 | 4,256 | 3,619 | $42.95 | -- |
| Sep 2025 | $119,685 | 3,441 | 3,058 | $34.78 | -- |
| Nov 2025 | $157,168 | 3,797 | 3,346 | $41.39 | +38.2% |
| Dec 2025 | $175,195 | 3,660 | 3,176 | $47.87 | +11.5% |

### Year-over-Year Comparison

| Month | 2024 Revenue | 2025 Revenue | YoY Change |
|-------|-------------|-------------|------------|
| January | $154,018 | $117,918 | **-23.4%** |
| February | $167,870 | $116,706 | **-30.5%** |
| March | $201,389 | $160,920 | **-20.1%** |
| April | $183,180 | $151,734 | -17.2% |
| May | $176,563 | $168,615 | -4.5% |
| June | $191,453 | $182,799 | -4.5% |
| July | $163,438 | $143,248 | -12.4% |
| August | $139,482 | $129,604 | -7.1% |
| September | $153,982 | $119,685 | -22.3% |
| October | $128,109 | $113,693 | -11.3% |
| **November** | **$136,905** | **$157,168** | **+14.8%** |
| **December** | **$165,436** | **$175,195** | **+5.9%** |
| **FULL YEAR** | **$1,961,823** | **$1,737,286** | **-11.4%** |

**The story of two halves:** Q1 2025 saw the worst YoY declines (-23% to -30%) as the large 2024 founding cohort continued to churn without replacement. However, the gap narrowed through mid-year (May/Jun at just -4.5%), and Nov-Dec 2025 turned positive (+14.8% and +5.9%). This reversal coincides with the TikTok Shop channel explosion.

### Quarterly Revenue

| Quarter | Revenue | Orders |
|---------|---------|--------|
| 2024-Q1 | $523,277 | 15,636 |
| 2024-Q2 | $551,196 | 15,226 |
| 2024-Q3 | $456,902 | 13,136 |
| 2024-Q4 | $430,449 | 11,280 |
| 2025-Q1 | $395,544 | 10,706 |
| 2025-Q2 | $503,148 | 13,127 |
| 2025-Q3 | $392,537 | 11,193 |
| 2025-Q4 | $446,057 | 10,815 |

**Seasonality:** Revenue peaks in March and June (spring/early summer fishing season), dips in August-October, and recovers for holiday gifting in November-December. June is the strongest month consistently.

---

## 4. Customer Acquisition & Channel Analysis

### New Customer Acquisition by Month

| Month | Total New | Shopify | PayPal | TikTok Shop | Shop Cash |
|-------|-----------|---------|--------|-------------|-----------|
| Jan 2024 | 3,110 | 2,491 | 601 | 0 | 3 |
| Jun 2024 | 752 | 549 | 101 | 10 | 78 |
| Dec 2024 | 755 | 524 | 71 | 2 | 122 |
| Mar 2025 | 848 | 677 | 83 | 3 | 76 |
| Jun 2025 | 705 | 546 | 46 | 3 | 98 |
| Sep 2025 | 301 | 232 | 37 | 14 | 17 |
| Oct 2025 | 374 | 296 | 29 | 38 | 9 |
| **Nov 2025** | **963** | **447** | **35** | **456** | **24** |
| **Dec 2025** | **1,049** | **588** | **0** | **424** | **32** |

### TikTok Shop: The Emerging Growth Engine

| Period | TikTok Orders | TikTok Revenue | TikTok New Customers |
|--------|--------------|----------------|---------------------|
| Jun-Dec 2024 | 28 | $1,411 | ~28 |
| Jan-Sep 2025 | 59 | $1,968 | ~57 |
| **Oct 2025** | **42** | **$1,827** | **38** |
| **Nov 2025** | **473** | **$19,693** | **462** |
| **Dec 2025** | **454** | **$19,384** | **439** |
| **Total** | **1,058** | **$44,282** | **~1,008** |

TikTok Shop exploded in November 2025 -- going from under $600/month to nearly $20K/month. In Nov-Dec 2025, TikTok drove 41.5% of all new customer acquisitions (880 of 2,123 new customers).

**However -- quality concern:** Only 16.6% of Nov-Dec 2025 new customers entered via a subscription first order (vs. typical rates of 50%+ for earlier cohorts). Average first-order value is $63.67, comparable to earlier periods, but these are mostly one-time mystery box buyers. Converting them to subscribers is the key challenge.

### Payment Gateway Revenue Share (Overall)

| Channel | Revenue | % of Total | Orders | Unique Customers |
|---------|---------|-----------|--------|-----------------|
| Shopify Payments | $2,559,685 | 81.3% | 45,837 | 13,357 |
| PayPal | $421,256 | 13.4% | 6,684 | 2,069 |
| TikTok Shop | $44,282 | 1.4% | 1,058 | 1,008 |
| Shop Cash + Shopify | $41,835 | 1.3% | 1,120 | 1,031 |
| Manual | $29,464 | 0.9% | 44 | 14 |
| Other | ~$53K | 1.7% | -- | -- |

---

## 5. Product Insights

### Revenue by Product Type (Top 15)

| Product Type | Revenue | % of Revenue | Quantity | Avg Price |
|-------------|---------|-------------|----------|-----------|
| **Subscription Box** | **$2,770,678** | **75.3%** | **82,637** | **$33.53** |
| Fishing Rod | $185,585 | 5.0% | 1,821 | $101.91 |
| Tackle Bundle | $91,344 | 2.5% | 2,646 | $34.52 |
| Tackle Bags & Boxes | $52,499 | 1.4% | 3,879 | $13.53 |
| Squarebill | $41,961 | 1.1% | 5,063 | $8.29 |
| Crankbaits | $33,427 | 0.9% | 4,527 | $7.38 |
| Spinnerbaits | $32,960 | 0.9% | 3,965 | $8.31 |
| Bladed Jigs | $31,753 | 0.9% | 3,927 | $8.09 |
| Topwater | $30,218 | 0.8% | 4,104 | $7.36 |

Non-subscription product revenue ($952K) is only 25.6% of total. The store catalog serves mainly as a subscriber add-on or conversion vehicle, not a standalone revenue driver.

### Subscription Tier Breakdown

| Tier | Revenue | % of Sub Revenue | Orders |
|------|---------|-----------------|--------|
| **Platinum** | **$2,112,436** | **76.2%** | **56,692** |
| Gold | $298,606 | 10.8% | 10,896 |
| Silver | $150,462 | 5.4% | 8,545 |
| Multi-Species | $65,271 | 2.4% | 1,844 |
| Kids/Bait | $60,559 | 2.2% | 1,813 |
| TikTok/Mystery | $47,972 | 1.7% | 969 |

Platinum is the dominant tier at 76% of subscription revenue. Gold + Silver together add 16%. The TikTok Mystery Box ($47,972) is almost entirely a Q4 2025 phenomenon.

### Subscription Term Length

| Term | Revenue | % of Sub Revenue | Avg Price/Unit |
|------|---------|-----------------|----------------|
| Monthly | $1,344,508 | 48.5% | $35.48 |
| 3-month | $672,228 | 24.3% | $33.39 |
| 6-month | $371,511 | 13.4% | $31.56 |
| 12-month | $354,846 | 12.8% | $31.46 |

Monthly plans dominate (48.5%), but prepaid multi-month plans together represent 51.5% of subscription revenue -- good for cash flow predictability and reduced churn surface area.

### Subscription Revenue by Region

| Region | Revenue | % of Sub Revenue |
|--------|---------|-----------------|
| Other/National | $1,404,211 | 50.7% |
| National (Gold) | $298,825 | 10.8% |
| Northeast | $295,302 | 10.7% |
| Midwest/Great Lakes | $260,452 | 9.4% |
| South/Florida | $230,444 | 8.3% |
| National (Silver) | $150,462 | 5.4% |
| West/PNW/Mountain | $130,982 | 4.7% |

### Basket Size

| Metric | Value |
|--------|-------|
| Average items per order | 1.78 |
| Median items per order | 1.0 |
| Average basket value | $36.82 |
| Median basket value | $25.98 |
| 1-item orders | 75.7% |
| 2+ item orders | 24.3% |

**Opportunity:** 75.7% of orders contain only 1 item. Cross-sell and bundle strategies could materially increase AOV. Even moving 10% of single-item orders to 2-item orders at the current add-on avg (~$10) would generate ~$76K in incremental annual revenue.

---

## 6. Refunds & Returns

### Overall Refund Metrics

| Metric | Value |
|--------|-------|
| Total Refunded | $92,196 |
| Refund Rate (% of revenue) | 2.42% |
| Orders with Refunds | 1,143 (1.13% of orders) |

### Monthly Refund Trends

| Month | Revenue | Refund Amount | Refund % of Rev |
|-------|---------|---------------|-----------------|
| Jan 2024 | $158,767 | $2,953 | 1.86% |
| Mar 2024 | $209,468 | $6,586 | 3.14% |
| Jul 2024 | $170,067 | $5,022 | 2.95% |
| Dec 2024 | $172,923 | $6,706 | **3.88%** |
| Jan 2025 | $121,389 | $5,050 | **4.16%** (worst month) |
| Mar 2025 | $165,736 | $1,529 | 0.92% |
| May 2025 | $171,302 | $1,147 | **0.67%** (best month) |
| Aug 2025 | $133,867 | $1,306 | 0.98% |
| Dec 2025 | $181,548 | $6,232 | 3.43% |

**Trend:** Refund rates improved significantly in mid-2025 (0.67%-1.29% in May-Aug) after a spike in late 2024/early 2025 (3.88%-4.16%). December months tend to have higher refund rates (gift returns). The dominant refund reasons are order cancellations (443 instances) and unlabeled refunds (548 with no note).

---

## 7. Customer Concentration & Segments

### Pareto Analysis

| Top N% | Customers | Revenue | % of Total Revenue |
|--------|-----------|---------|-------------------|
| Top 1% | 191 | $322,120 | 8.7% |
| Top 5% | 958 | $1,058,489 | 28.7% |
| Top 10% | 1,917 | $1,658,289 | 44.9% |
| Top 20% | 3,835 | $2,422,403 | 65.7% |
| Top 50% | 9,587 | $3,374,939 | 91.5% |

### Customer Value Segments

| Segment | Customers | % Custs | Revenue | % Rev | Avg LTV | Avg Orders |
|---------|-----------|---------|---------|-------|---------|------------|
| Whale ($2000+) | 31 | 0.2% | $94,656 | 2.6% | $3,053 | 49.7 |
| High Value ($1000-2000) | 487 | 2.5% | $571,658 | 15.5% | $1,174 | 28.3 |
| Mid Value ($500-1000) | 1,617 | 8.4% | $1,103,627 | 29.9% | $683 | 17.1 |
| Core ($100-500) | 6,487 | 33.8% | $1,516,342 | 41.1% | $234 | 6.2 |
| Low Value ($25-100) | 7,131 | 37.2% | $372,527 | 10.1% | $52 | 1.6 |
| Micro (<$25) | 3,422 | 17.8% | $30,681 | 0.8% | $9 | 1.9 |

**Concentration risk is moderate:** The top 10% drive 45% of revenue, but the "Core" segment ($100-500 LTV, 6,487 customers) is the backbone at 41% of revenue. The business is not excessively dependent on a handful of whales.

---

## 8. Strategic Recommendations

### Immediate Priorities (0-3 months)

1. **Convert TikTok buyers to subscribers.** 880 new TikTok customers in Nov-Dec 2025, but only 16.6% started with a subscription. Build a TikTok-to-subscription conversion funnel: targeted email sequences within 7 days of first purchase offering a Platinum trial at discount.

2. **Attack the M1-M3 churn cliff.** The biggest retention drop-off is between Month 1 and Month 3. Deploy automated win-back campaigns at day 25 (before M1 renewal decision) and day 55. Consider a "Month 2 bonus" lure pack for new subscribers.

3. **Increase basket size.** 75.7% of orders are single-item. Implement cross-sell recommendations at checkout (add a tackle bag for $13.53, add bladed jigs for $8.09). Target: move 2+ item order rate from 24% to 35%.

### Medium-Term (3-6 months)

4. **Scale TikTok Shop aggressively.** It went from $0 to $20K/month overnight. Invest in TikTok-native content and mystery box offerings to sustain this momentum. The channel has already proven product-market fit at scale.

5. **Prepaid plan push.** Multi-month prepaid plans (3/6/12 month) already represent 51.5% of subscription revenue with lower per-unit prices but dramatically better retention. Incentivize 3-month minimum commitments for new subscribers.

6. **Reactivation campaign.** Of 19,175 customers who have ever ordered, only 5,174 (27%) were active in the last 90 days. A targeted win-back campaign to the ~14,000 lapsed customers (especially the 4,697 Jan 2024 cohort) could be high-ROI.

### Structural Observations

7. **Revenue decline is a funnel problem, not a retention problem.** MoM retention has been stable at ~75% since mid-2024. The YoY decline was caused by lower acquisition volume (500-800 new customers/month vs. the one-time 4,697 in Jan 2024). The Q4 2025 TikTok surge shows the business can acquire at scale when channels are working.

8. **The Jan 2024 cohort effect.** This single cohort of 4,697 customers generated $1.55M in lifetime revenue (42% of the total). As it churns naturally, it creates a persistent headwind. Every strategic initiative should be benchmarked against replacing this cohort's contribution.

9. **Refund rates improved.** The 2.42% overall rate is healthy for D2C subscription. Mid-2025 rates dropped below 1% in multiple months, suggesting fulfillment and product quality improvements took hold. Monitor December spikes (gift-related returns).

---

## Appendix: Key Data Sources

- `/Users/matt/Documents/monsterbass/shopify_cleaned/orders_summary.csv` -- 101,126 orders
- `/Users/matt/Documents/monsterbass/shopify_cleaned/order_line_items.csv` -- 151,604 line items
- `/Users/matt/Documents/monsterbass/shopify_cleaned/customers.csv` -- 258,262 customer records
- `/Users/matt/Documents/monsterbass/shopify_cleaned/refunds_detail.csv` -- Refund detail
- `/Users/matt/Documents/monsterbass/output/shopify_analysis/customer_cohorts.csv` -- Pre-computed cohorts
- `/Users/matt/Documents/monsterbass/output/shopify_analysis/revenue_by_product_type.csv` -- Product type revenue

All figures computed directly from the above datasets using Python/Pandas. Date range: January 1, 2024 through December 31, 2025.
