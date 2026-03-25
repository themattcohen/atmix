# MonsterBass Accrual Basis Analysis Report

**Entity:** Outdoor Playground Inc. (DBA MonsterBass)
**Period Analyzed:** January 2024 - December 2025
**Report Date:** January 31, 2026
**Prepared For:** CEO Audit Review

---

## Executive Summary

**ASSESSMENT: MODIFIED CASH BASIS (Not True Accrual)**

Despite QuickBooks reports displaying "Accrual Basis" in the footer, the company's books demonstrate characteristics of **Modified Cash Basis** accounting. The books contain some accrual elements (Inventory Asset, Accounts Payable) but lack critical accrual accounts and adjustments necessary for GAAP-compliant accrual accounting.

---

## 1. Accrual Accounts Presence Check

### Present (Accrual Elements)

| Account | Status | Range (2024) |
|---------|--------|--------------|
| Accounts Payable (A/P) | Present | $137,283 - $229,390 |
| Inventory Asset | Present | $273,915 - $516,352 |

### Missing (Cash Basis Indicators)

| Account | Status | Impact |
|---------|--------|--------|
| Accounts Receivable | NOT PRESENT | Acceptable for D2C model |
| **Prepaid Expenses** | NOT PRESENT | Annual expenses not amortized |
| **Deferred Revenue** | NOT PRESENT | Critical for subscription business |
| **Accrued Liabilities** | NOT PRESENT | Expenses recognized on payment only |

---

## 2. Revenue Recognition Analysis

### Finding: Revenue Recorded on Cash Receipt (Cash Basis)

Evidence shows revenue is recognized when payment processor deposits hit the bank, NOT when orders are placed or fulfilled.

**Comparison: P&L Shopify Revenue vs GL Bank Deposits**

| Month | P&L Revenue | GL Deposits | Difference |
|-------|-------------|-------------|------------|
| January 2024 | $96,112.82 | $190,660.76 | -$94,547.94 |
| February 2024 | $107,402.26 | $212,650.46 | -$105,248.20 |
| March 2024 | $128,222.73 | $254,430.20 | -$126,207.47 |
| April 2024 | $130,856.15 | $256,252.02 | -$125,395.87 |
| May 2024 | $111,288.62 | $217,878.88 | -$106,590.26 |
| June 2024 | $125,881.04 | $244,975.28 | -$119,094.24 |
| July 2024 | $119,220.36 | $222,727.86 | -$103,507.50 |
| August 2024 | $86,138.83 | $168,693.16 | -$82,554.33 |
| September 2024 | $103,261.89 | $203,880.78 | -$100,618.89 |
| October 2024 | $90,549.01 | $172,699.70 | -$82,150.69 |
| November 2024 | $96,719.42 | $191,375.32 | -$94,655.90 |
| December 2024 | $103,564.91 | $201,358.64 | -$97,793.73 |

**Note:** The difference between GL deposits and P&L revenue likely represents:
- Payment processing fees netted against revenue
- Refunds and chargebacks
- Other adjustments

The key finding is that revenue flows directly from bank deposits to the income statement without timing adjustments.

### Subscription Revenue Concern

MonsterBass operates as a subscription box service. Under proper accrual accounting:
- Subscription payments received in advance should be recorded as **Deferred Revenue** (liability)
- Revenue should be recognized when boxes are shipped/fulfilled

**Finding:** No Deferred Revenue account exists. This means subscription payments are recognized immediately as revenue upon receipt (cash basis treatment).

---

## 3. COGS and Inventory Matching Analysis

### Finding: Partial Accrual Treatment

The company maintains an Inventory Asset account and records COGS via month-end journal entries.

**Monthly COGS Journal Entries Match P&L Product Sold Exactly:**

| Month | P&L Product Sold | GL Journal Entry |
|-------|------------------|------------------|
| January 2024 | $66,292.42 | -$66,292.42 |
| February 2024 | $48,828.99 | -$48,828.99 |
| March 2024 | $58,707.65 | -$58,707.65 |
| April 2024 | $49,493.37 | -$49,493.37 |
| May 2024 | $67,629.46 | -$67,629.46 |
| June 2024 | $49,760.38 | -$49,760.38 |
| July 2024 | $52,067.39 | -$52,067.39 |
| August 2024 | $36,163.07 | -$36,163.07 |
| September 2024 | $36,107.24 | -$36,107.24 |
| October 2024 | $41,855.67 | -$41,855.67 |
| November 2024 | $47,684.77 | -$47,684.77 |
| December 2024 | $64,137.76 | -$64,137.76 |

**Correlation Analysis:**
- A/P Change vs Implied Purchases: **0.7529** (Strong positive)
- Inventory Change vs COGS: **-0.0932** (Weak negative)

**Interpretation:** The strong A/P correlation suggests inventory purchases flow through Accounts Payable (accrual treatment). However, the weak inventory-COGS correlation raises questions about whether COGS is properly matched to sales or estimated via another method.

---

## 4. Expense Timing Analysis

### Finding: Mixed Treatment with Cash Basis Dominant

**Health Insurance (Monthly Expense):**

| Month | Amount | Assessment |
|-------|--------|------------|
| Jan-Oct 2024 | $2,362.06 | Consistent |
| Nov-Dec 2024 | $2,605.40 | Consistent |

- Coefficient of Variation: **0.0377** (Very low)
- This is likely billed monthly, not an accrual adjustment

**Liability Insurance (Annual Policy):**

| Month | Amount |
|-------|--------|
| May 2024 | $10,205.28 |
| May 2025 | $8,672.12 |

**This is a clear CASH BASIS indicator.** Under proper accrual:
- The annual premium would be recorded as Prepaid Insurance (asset)
- Monthly expense of ~$850 would be recognized each month
- Instead, the full amount hits the P&L when paid

---

## 5. Assessment Summary

### Accrual Elements Present

1. **Inventory Asset** tracked on Balance Sheet
2. **Accounts Payable** for vendor obligations
3. **COGS Journal Entries** at month-end

### Cash Basis Elements Present

1. **Revenue** recognized on cash receipt
2. **No Deferred Revenue** for subscriptions
3. **No Prepaid Expenses** for annual policies
4. **No Accrued Liabilities** for incurred but unpaid expenses
5. **Annual insurance** expensed when paid

---

## Final Assessment

| Category | Treatment | Evidence |
|----------|-----------|----------|
| **Revenue Recognition** | CASH BASIS | Revenue = Bank deposits |
| **COGS/Inventory** | PARTIAL ACCRUAL | Inventory asset + JE adjustments |
| **Operating Expenses** | CASH BASIS | No prepaid/accrued accounts |
| **Subscription Revenue** | CASH BASIS | No deferred revenue |

### Classification: **MODIFIED CASH BASIS**

This hybrid approach is common in small businesses but is **NOT GAAP-compliant accrual accounting**. The QuickBooks designation of "Accrual Basis" on reports is misleading.

---

## Implications for Audit

### 1. Financial Statement Accuracy

- **Revenue timing:** May be misstated if significant subscription payments are received near month/year-end
- **Expense matching:** Annual expenses create artificial volatility in monthly P&L
- **COGS accuracy:** Unclear how month-end COGS amounts are calculated

### 2. Required Adjustments for True Accrual

To convert to GAAP accrual basis, the following accounts and adjustments are needed:

| Account | Purpose | Estimated Impact |
|---------|---------|------------------|
| Deferred Revenue | Subscription prepayments | Material - TBD |
| Prepaid Insurance | Liability policy amortization | ~$10K annually |
| Prepaid Expenses | Other annual subscriptions | TBD |
| Accrued Liabilities | Services received not yet billed | TBD |

### 3. Audit Recommendations

1. **Quantify Deferred Revenue:** Analyze subscription billing cycles to determine revenue that should be deferred at period-end

2. **Identify Prepaid Expenses:** Review all annual payments for services/insurance that span multiple periods

3. **Verify COGS Calculation:** Understand methodology for month-end COGS journal entries - are they based on actual sales or estimates?

4. **Document Accounting Policy:** Clearly state the accounting basis in use (Modified Cash Basis) rather than claiming accrual

---

## Appendix: Data Sources

- `/cleaned/outdoor_playground/general_ledger.csv` - 1.7MB, all GL transactions
- `/cleaned/outdoor_playground/pl_monthly.csv` - Monthly P&L Jan 2024 - Dec 2025
- `/cleaned/outdoor_playground/balance_sheet_monthly.csv` - Monthly Balance Sheet Jan 2024 - Dec 2025

**Analysis performed:** January 31, 2026
