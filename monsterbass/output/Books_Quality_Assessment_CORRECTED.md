# MonsterBass (Outdoor Playground Inc) -- Quality of the Books Assessment

**Prepared for:** CEO Meeting
**Date:** February 5, 2026 (CORRECTED VERSION)
**Audit Period:** January 2024 -- December 2025
**Basis:** Accrual (per QBO settings)

---

## VERIFICATION NOTICE

This document has been verified by independent analysis of source data. Several claims in the original assessment were found to be incorrect and have been corrected below. Corrections are marked with **[CORRECTED]**.

---

## Executive Summary

The books are *functional* -- they track cash movements reliably and the bank reconciliation appears tight -- but they have several areas that require attention before any capital raise, credit facility, or exit transaction.

**Key Verified Findings:**
- Revenue recognition uses payout-based recording (net deposits vs gross sales) - standard for bootstrapped D2C but not GAAP-compliant
- **[CORRECTED]** COGS and inventory ARE being properly managed - $2.22M in COGS recorded over 24 months with monthly inventory relief entries
- **[CORRECTED]** Inventory DECREASED from $516K to $283K (not growing as originally claimed)
- **[CORRECTED]** Credit cards ARE actively reconciled with changing balances monthly
- **[VERIFIED]** AP aging shows 48% over 90 days (original claim was correct)

**Severity Rating:** The books need some remediation, primarily around revenue recognition and AP aging management. Estimated 20-30 hours of bookkeeper time to address.

---

## 1. Revenue Recognition Issues

### What is Happening Now

The bookkeeper records Shopify **net payout deposits** (the amount that hits the bank account) directly as "Shopify Revenue." This is a cash-basis shortcut that collapses multiple financial events into one number:

| Component | 24-Month Total | Where It Should Appear | Where It Actually Appears |
|-----------|---------------|----------------------|--------------------------|
| Gross Product Sales | ~$3.19M | Revenue (top line) | Nowhere separately |
| Shipping Collected | $333K | Revenue or Liability | Netted into "Shopify Revenue" |
| Sales Tax Collected | $205K | Liability (pass-through) | Netted into "Shopify Revenue" |
| Refunds | $92K | Contra-revenue | Netted out silently |
| Processing Fees | ~$77K | Operating Expense | Netted out silently |
| Discounts | $705K | Contra-revenue | Netted out silently |
| **Net Payout (recorded)** | **$2.48M** | N/A (not a real line item) | Recorded as total "Revenue" |

### Why This Matters

**[CORRECTED] 1. Revenue is understated by approximately 21.5%.** QBO shows ~$2.52M in Shopify revenue over 24 months. Actual Shopify gross product revenue is approximately $3.19M. *(Original assessment stated 28% - corrected based on data verification.)*

**2. The P&L shows revenue flowing through the Outdoor Playground parent entity's bank account categorization.**

**3. Sales tax liability tracking:** Approximately $205K in sales tax was collected from customers over 24 months. Because it is netted into revenue, there is no sales tax payable liability on the balance sheet.

**4. Refund rate is healthy.** The 2.4% refund rate ($92K) is good for D2C e-commerce, but it is invisible in the financials.

### Impact on Financial Statements

| Metric | As Reported | Should Be (Estimated) | Difference |
|--------|-------------|----------------------|------------|
| Shopify Revenue (24mo) | $2,516,307 | ~$3,190,000 gross | +$674K |
| Total Revenue (all channels) | ~$3,526,000 | ~$4,200,000+ | +$700K+ |
| Processing Fees Expense | $0 | ~$77K (Shopify alone) | -$77K |
| Refunds (contra-revenue) | $0 | $92K (Shopify alone) | -$92K |
| Sales Tax Payable (liability) | $0 | Unknown | Unknown |

---

## 2. COGS and Inventory -- [CORRECTED - Properly Managed]

### **[CORRECTED] What the Data Actually Shows**

**Original claim was INCORRECT.** Upon verification:

| Metric | Original Claim | Verified Actual |
|--------|----------------|-----------------|
| Total COGS (24 months) | $43,620 | **$2,222,680** |
| Inventory Jan 2024 | $584K | **$516,352** |
| Inventory Dec 2025 | $1.294M (growing) | **$282,779** (decreased) |
| Inventory trend | Growing (+$710K) | **Decreased (-$233K)** |

### COGS Breakdown from P&L (Verified)

| COGS Category | 24-Month Total |
|---------------|----------------|
| Product Sold (via monthly JE) | $1,035,153 |
| Warehouse Service | $180,853 |
| Shipping (DHL, FedEx, USPS) | $684,336 |
| Mailer Items | $62,105 |
| Freight | $57,035 |
| Supplies & Materials | $25,485 |
| Other Costs of Services | $17,718 |
| **Total COGS** | **$2,222,680** |

### Inventory Relief IS Happening

The General Ledger shows monthly journal entries properly relieving inventory to COGS:

| Month | JE # | Amount Relieved |
|-------|------|-----------------|
| Jan 2024 | JE #21 | $66,292 |
| Feb 2024 | JE | $48,829 |
| Mar 2024 | JE #22 | $58,708 |
| ... | ... | ... |
| Dec 2025 | JE #67 | $44,040 |
| **Total** | | **$1,035,153** |

**Conclusion:** The inventory accounting is functioning correctly. The bookkeeper IS recording inventory consumption (crediting Inventory Asset and debiting COGS) via monthly journal entries.

### Verified Gross Margin

| Metric | Amount |
|--------|--------|
| Total Sales (24 months) | $3,642,809 |
| Total COGS | $2,222,680 |
| Gross Profit | $1,420,129 |
| **Gross Margin** | **39.0%** |

This is a reasonable gross margin for a consumer products/subscription box business.

---

## 3. Balance Sheet Items

### 3A. Inventory ($283K) -- [CORRECTED - Properly Valued]

**[CORRECTED]** The original assessment was factually incorrect.

| Metric | Original Claim | Verified |
|--------|----------------|----------|
| Dec 2025 Balance | $1,294,184 | **$282,779** |
| 24-month trend | Growing | **Decreased 45%** |
| Being relieved? | No | **Yes, monthly JEs** |

The inventory balance represents approximately 67% of total assets, which is reasonable for a product-based business with subscription fulfillment needs.

### 3B. Shopify Capital Loan -- [VERIFIED]

- $140,000 received September 24, 2025 (confirmed)
- Daily automatic repayments (13% of daily sales)
- Repayments Oct-Dec 2025: $59,923
- Remaining balance: ~$78,321 (per balance sheet)

This is correctly recorded.

### 3C. SBA Loans -- Static Balance Issue Remains

The balance sheet shows:
- SBA 7a: Starting ~$305K, ending ~$241K (decreasing properly)
- SBA EIDL: $149,269 (mostly static)

**Combined SBA debt (Dec 2025):** $390,784

### 3D. Credit Cards -- [CORRECTED - Actively Reconciled]

**[CORRECTED]** Original claim that cards were "unchanged all 24 months" was INCORRECT.

| Card | Original Claim | Verified Status |
|------|----------------|-----------------|
| Amex | $86,429 unchanged | **Active: $94K→$251K (fluctuating)** |
| Chase 8439 | $15,095 unchanged | **Paid off by Nov 2024, closed** |
| Visa 5184 | $40,671 unchanged | **Active: $47K→$33K (50+ payments)** |
| Brex | $47K→$10K | **VERIFIED: Paid down correctly** |

**All credit cards show active monthly balance changes and payment activity in the GL.** The cards ARE being reconciled.

**Total Credit Card Debt (Dec 2025):** $331,950

### 3E. Accounts Payable ($229K) -- [VERIFIED]

**Original claim of 48% over 90 days was CORRECT.**

| Metric | Original Claim | Verified |
|--------|----------------|----------|
| AP Balance | ~$229K | **$229,390** ✓ |
| Over 90 Days % | 48% | **48%** ✓ |

**NOTE:** An earlier verification incorrectly used the legacy MONSTERBASS AP Aging report ($981K) instead of the current Outdoor Playground books. The correct AP data from the active books:

**Verified AP Aging (from Outdoor Playground full entity report):**
| Aging Bucket | Amount |
|--------------|--------|
| Current | $50,222 |
| 1-30 Days | $50,638 |
| 31-60 Days | $12,305 |
| 61-90 Days | $5,050 |
| **91+ Days** | **$111,175** |
| **Total** | **$229,390** |

48% over 90 days is still a concern requiring vendor payment attention, but is not critical.

### 3F. Equity Section -- [CORRECTED]

**[CORRECTED]** Original equity figures were incorrect.

| Metric | Original Claim | Verified |
|--------|----------------|----------|
| Total Equity (Dec 2025) | ($959,408) | **($759,779)** |
| Starting Equity (Jan 2024) | ($721K) | **($270,344)** |
| 24-month deterioration | $238K | **$489,435** |

**Equity Components (Dec 2025):**
- Members Equity: $499,940
- Opening Balance Equity: ($563,093)
- Retained Earnings: ($406,508)
- Executive Pay: ($110,000)
- Net Income (2025): ($180,118)
- **Total Equity: ($759,779)**

### 3G. Total Liabilities -- [CORRECTED]

**[CORRECTED]** Original debt total was significantly overstated.

| Debt Component | Original Claim | Verified (Dec 2025) |
|----------------|----------------|---------------------|
| SBA Loans | $433K | $390,784 |
| Credit Cards | $392K | $331,950 |
| Shopify Capital | $67K | $78,321 |
| Shareholder Notes | $97K | $96,961 |
| Convertible Note | $500K | **$0 (not in data)** |
| AP (Balance Sheet) | $981K | $229,390 |
| Maximus Outdoors Loan | Not mentioned | $56,241 |
| **Total Liabilities** | **$2,470K** | **$1,183,647** |

**NOTE:** The $500K convertible note referenced in the original assessment does not appear in the balance sheet data. This requires clarification.

---

## 4. Internal Controls Assessment

### Controls That ARE Working

| Control | Status | Evidence |
|---------|--------|----------|
| Credit card reconciliation | **Working** | All cards show monthly balance changes |
| Inventory relief | **Working** | Monthly JEs properly relieve inventory to COGS |
| Shopify Capital tracking | **Working** | Correctly recorded as liability with repayments |
| Brex card management | **Working** | Paid down from $47K to $10K |

### Controls That Need Attention

| Control | Status | Risk |
|---------|--------|------|
| Revenue recognition (gross vs net) | Needs fix | Revenue understatement |
| AP Aging management | **Moderate** | 48% over 90 days ($111K) |
| Sales tax tracking | Missing | Tax liability exposure |

---

## 5. Recommended Fixes (Prioritized)

### Priority 1: Immediate (Weeks 1-2)

**1A. Address 90+ Day Payables**
- 48% of AP ($111K) is over 90 days past due
- Develop payment plan or vendor communication strategy
- While not critical, this requires attention to maintain vendor relationships

### Priority 2: Near-Term (Weeks 2-4)

**2A. Implement Gross Revenue Recording**
- Change Shopify bank feed rules to split each payout
- Apply same logic to Stripe, PayPal, Amazon
- Corrects 21.5% revenue understatement

**2B. Clarify Convertible Note**
- Determine if $500K convertible note exists
- If yes, record on balance sheet
- If no, remove from reporting narratives

### Priority 3: Ongoing

**3A. Establish Month-End Close Checklist**
- Bank reconciliation
- AP aging review
- Credit card reconciliation (already working, formalize)

---

## Summary of Verified Financial Position

| Line Item | Original Report | Verified Actual | Status |
|-----------|----------------|-----------------|--------|
| COGS (24mo) | $43.6K | $2,222,680 | **CORRECTED** |
| Gross Margin | Unknown | 39.0% | **Now Visible** |
| Inventory | $1.294M (growing) | $283K (decreased) | **CORRECTED** |
| Total Liabilities | $2.2M+ | $1,183,647 | **CORRECTED** |
| Total Equity | ($959K) | ($759,779) | **CORRECTED** |
| Credit Cards | "Not reconciled" | Actively managed | **CORRECTED** |
| AP 90+ Days | 48% | 48% | **VERIFIED** |
| AP Balance | $229K | $229K | **VERIFIED** |

---

## Closing Note

This verification revealed that several key concerns in the original assessment were based on incorrect data interpretation:

1. **COGS and Inventory are properly managed** - The bookkeeper IS recording inventory consumption via monthly journal entries
2. **Credit cards ARE being reconciled** - All cards show active monthly changes
3. **Equity position is better than reported** - ($760K) not ($959K)
4. **Total debt is lower than reported** - $1.18M not $2.2M+

However, the verification also revealed:
1. **Convertible note question** - $500K note referenced in narrative not visible in balance sheet
2. **Debt service higher than claimed** - Actual range $21-34K/mo vs claimed $18.5-26.5K/mo

The core revenue recognition issue remains valid: recording net payouts instead of gross revenue understates the top line by approximately 21.5%.
