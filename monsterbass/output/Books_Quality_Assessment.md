# MonsterBass (Outdoor Playground Inc) -- Quality of the Books Assessment

> **⚠️ SUPERSEDED DOCUMENT**
>
> This document contains errors that have been corrected in `Books_Quality_Assessment_CORRECTED.md`.
> Key errors in this version:
> - Used MONSTERBASS legacy books instead of current Outdoor Playground books
> - Incorrectly stated inventory was growing ($584K→$1.29M) - actually decreased ($516K→$283K)
> - Incorrectly stated credit cards were static - actually actively reconciled
> - Overstated AP at $981K instead of correct $229K
> - Overstated negative equity at ($959K) instead of correct ($760K)
>
> **USE `Books_Quality_Assessment_CORRECTED.md` INSTEAD**

**Prepared for:** CEO Meeting
**Date:** February 5, 2026 (SUPERSEDED - see CORRECTED version)
**Audit Period:** January 2024 -- December 2025
**Basis:** Accrual (per QBO settings)

---

## Executive Summary

The books are *functional* -- they track cash movements reliably and the bank reconciliation appears tight -- but they are **not GAAP-compliant** and would not survive scrutiny from a buyer, lender, or sophisticated investor. The core problem is structural: revenue is recorded as net bank deposits rather than as actual sales, which cascades into understated revenue, hidden expenses, missing tax liabilities, and an inventory balance that cannot be validated.

None of this is unusual for a bootstrapped D2C company with a single bookkeeper. These are fixable issues. But they need to be fixed before any capital raise, credit facility, or exit transaction.

**Severity Rating:** The books need meaningful remediation, not just cleanup. Estimated 40-60 hours of bookkeeper time to restate, plus ongoing process changes.

---

## 1. Revenue Recognition Issues

### What is Happening Now

The bookkeeper records Shopify **net payout deposits** (the amount that hits the bank account) directly as "Shopify Revenue." This is a cash-basis shortcut that collapses five distinct financial events into one number:

| Component | 24-Month Total | Where It Should Appear | Where It Actually Appears |
|-----------|---------------|----------------------|--------------------------|
| Gross Product Sales | ~$3.19M | Revenue (top line) | Nowhere separately |
| Shipping Collected | $333K | Revenue or Liability | Netted into "Shopify Revenue" |
| Sales Tax Collected | $205K | Liability (pass-through) | Netted into "Shopify Revenue" |
| Refunds | $92K | Contra-revenue | Netted out silently |
| Processing Fees | ~$77K | Operating Expense | Netted out silently |
| Discounts | $705K | Contra-revenue | Netted out silently |
| **Net Payout (recorded)** | **$2.48M** | N/A (not a real line item) | Recorded as total "Revenue" |

The same pattern appears to apply to Stripe ($513K), PayPal ($411K), and Amazon ($46K) -- all channels appear to record net deposits as revenue.

### Why This Matters

**1. Revenue is understated by approximately $700K (28%).** QBO shows ~$2.52M in Shopify revenue over 24 months. Actual Shopify gross product revenue (after removing shipping/tax but before fees/refunds) is approximately $3.19M. The total revenue understatement across all channels could be $900K-$1M when including the other platforms.

**2. The P&L is structurally misleading.** The P&L in the MONSTERBASS class shows only $0 in revenue (it captures only COGS and expenses allocated to this class -- $43.6K COGS and $213K expenses = $257K net loss). The actual revenue flows through the Outdoor Playground parent entity's bank account categorization. There is no clean P&L that shows: Revenue minus COGS minus Expenses = Net Income for MonsterBass operations.

**3. Gross margin is unknowable.** Without gross revenue on the top line and COGS properly matched, no one can calculate actual product margins. The COGS recorded in the P&L ($43.6K over 24 months) is clearly incomplete for a business doing $3M+ in product sales.

**4. Sales tax liability is invisible.** Approximately $205K in sales tax was collected from customers over 24 months. Because it is netted into revenue, there is no sales tax payable liability on the balance sheet and no audit trail showing collection vs. remittance. If the company is behind on sales tax filings, there is no way to determine the exposure from the books alone.

**5. Refund rate is obscured.** The 2.4% refund rate ($92K) is actually healthy for D2C e-commerce, but it is invisible in the financials. An investor or buyer would want to see this tracked.

### Impact on Financial Statements

| Metric | As Reported | Should Be (Estimated) | Difference |
|--------|-------------|----------------------|------------|
| Shopify Revenue (24mo) | $2,516,307 | ~$3,190,000 gross | +$674K |
| Total Revenue (all channels) | ~$3,526,000 | ~$4,200,000+ | +$700K+ |
| Processing Fees Expense | $0 | ~$77K (Shopify alone) | -$77K |
| Refunds (contra-revenue) | $0 | $92K (Shopify alone) | -$92K |
| Sales Tax Payable (liability) | $0 | Unknown | Unknown |

---

## 2. Expense Classification Issues

### Processing Fees Are Not Recorded

Shopify processing fees totaled approximately $77,000 over the audit period (visible in the Shopify payout data as "Charges_Fee"). These are real operating expenses that reduce the company's gross margin. They should appear as a line item such as "Payment Processing Fees" or "Merchant Fees" in operating expenses. The same issue applies to Stripe, PayPal, and Amazon fees, which are also netted.

**Estimated total processing fees across all channels: $100K-$120K over 24 months.**

### Advertising Expense -- Brex Card Is Properly Expensed

Facebook/Meta ($234,792) and Google ($245,531) advertising are charged to the Brex credit card and **are properly recorded as expenses in the GL**. Facebook spend peaked at ~$18K/month (Sep 2024), declined to ~$6-7K/month in Q4 2025. Google peaked at ~$16.9K/month (Jul 2024), declined to ~$8K/month in late 2025. Both channels remained active through year-end -- they were not shut off.

The Brex card balance in the primary books (Outdoor Playground) has actually been **paid down** from $47K (Jan 2024) to $10K (Dec 2025). Total charges of $481K against $527K in payments from checking. Note: the legacy MONSTERBASS books show a different Brex balance ($62K growing to $250K) -- this is one of the irreconcilable differences between the two sets of books that requires investigation.

### COGS Is Substantially Under-Recorded

The P&L shows only $43,620 in total COGS over 24 months for a business with $3M+ in product revenue. This is clearly wrong. For a subscription tackle box company, COGS should include:

- Product costs (lures, tackle, accessories)
- Box/packaging materials
- Kitting/assembly labor
- Warehouse fulfillment fees
- Outbound shipping costs

From the GL, inventory purchases flow to the Inventory Asset account on the balance sheet but are rarely relieved to COGS. The Inventory Asset balance has grown from $584K (Jan 2024) to $1.294M (Dec 2025) -- an increase of $710K -- which suggests that product costs are being capitalized to inventory but **never expensed when products are shipped to customers.**

This means:
- COGS is understated by hundreds of thousands of dollars
- Inventory is overstated by the same amount
- Gross profit is meaningless as reported
- Net income is significantly overstated (losses are actually larger than reported)

### Warehouse and Fulfillment Costs

Eagle Warehouse appears regularly in the GL as bill payments, but these costs are flowing through A/P and may be categorized inconsistently. Some months show warehouse costs; most do not appear in the P&L COGS section.

---

## 3. Balance Sheet Concerns

### 3A. Inventory ($1.294M) -- Highest Risk Item

**The inventory balance is the single largest concern in these books.**

- Balance sheet shows $1,294,184 in Inventory Asset as of December 2025
- This represents 89% of total assets ($1.45M)
- The balance has grown every single month for 24 consecutive months
- There is no evidence of inventory being relieved when products are sold/shipped

This strongly indicates that the bookkeeper records inventory **purchases** (debiting Inventory Asset when bills are entered) but does not record inventory **consumption** (crediting Inventory Asset and debiting COGS when orders are fulfilled).

For a company shipping ~4,000 orders per month, the inventory relief should be a regular, material journal entry. Its absence means:

1. Inventory is overstated (likely significantly)
2. COGS is understated by the same amount
3. The last physical inventory count is unknown (Question #9 on the Master Questions List)
4. The inventory costing method is undocumented (Question #8)
5. There is no way to determine whether the $1.294M figure bears any relationship to actual on-hand inventory

**Estimated overstatement:** If true COGS is 45-55% of gross revenue (typical for D2C subscription boxes), actual COGS should be $1.4-1.8M over 24 months. Only $43.6K has been expensed. The inventory account is likely overstated by $500K-$1M+.

### 3B. Shopify Capital Loan

**What the data shows:**
- $140,000 received September 24, 2025 (confirmed in GL)
- Daily automatic repayments from Shopify payouts (13% of daily sales)
- Repayments Oct-Dec 2025: $16,074 + $15,862 + $27,987 = $59,923
- Implied remaining balance: ~$80K (consistent with the ~$66.6K-$78K range from different data sources)

**Recording:** The bookkeeper created a "Shopify Capital" liability account and is correctly recording the initial deposit as a credit (liability increase) and daily repayments as debits (liability decrease). This is one of the better-handled items in the books.

**Concern:** The Shopify Capital fee ($1,540/month or ~$18.5K annualized) needs to be separately identified as interest/financing expense, not just netted into the principal repayment. The total cost of capital (factor rate) should be documented.

### 3C. SBA Loans -- Static Balances

The balance sheet shows:
- SBA 7a: $301,932 (unchanged for 24 months)
- SBA EIDL: $131,541 (unchanged for 24 months)

Meanwhile, the GL shows monthly payments:
- SBA 7a: ~$4,723-$4,836/month ($116K paid over 24 months)
- EIDL: $731/month ($17.5K paid over 24 months)

**The loan balances are never reduced.** The monthly payments appear to be coded to "Business loan interest" expense rather than split between principal reduction and interest. This means:
- Liabilities are overstated (the $301.9K SBA 7a balance should be ~$185-$240K after principal payments)
- Interest expense may be overstated (if the full payment is coded as interest)
- Or principal payments are being lost somewhere in the accounting

### 3D. Credit Cards -- Mixed Picture

Several credit card balances appear frozen for extended periods:
- Amex 87005: $86,429 (unchanged all 24 months) -- not being reconciled
- Chase 8439: $15,095 (unchanged all 24 months) -- not being reconciled
- Visa 5184: $40,671 (unchanged all 24 months) -- not being reconciled
- **Brex 0172: Actively managed and paid down from $47K to $10K** -- this card carries Facebook and Google ads and IS being properly reconciled. The legacy MONSTERBASS books show a different Brex figure ($250K) which appears incorrect.

The Amex, Chase, and Visa cards appear to be legacy balances that are no longer being reconciled in QBO. If these cards are still active, the actual liabilities may differ from what is shown. However, the combined stale balance ($142K) is lower risk than previously estimated now that Brex is confirmed as properly managed.

### 3E. Accounts Payable ($981K)

AP has grown from $221K to $981K over 24 months. From the Master Questions List, 48% of payables are 90+ days past due. The largest single vendor exposure is Maximus Outdoors ($240K total across AP, loans, and shareholder notes).

### 3F. Accounts Receivable (-$1,700)

The negative AR balance ($1,700 credit) has been static for the entire 24-month period. This is either a data entry error or a customer overpayment that was never cleared. It is immaterial but indicates inattention to balance sheet cleanup.

### 3G. Equity Section

- **Executive Pay: ($250,000)** -- This is recorded in equity, not as an expense. It needs clarification: if this represents salary owed but not paid, it should be a liability (accrued compensation). If it is owner distributions, it is correctly in equity but should be labeled as such. If it is deferred compensation, the tax treatment matters significantly.
- **Retained Earnings: ($1.13M)** -- Accumulated losses. This is directionally correct given the company's history.
- **Science Convertible Note: $500K** -- Carried as long-term liability. Terms unknown (Question #10). No interest accrual is visible.
- **Shareholder Loan: $96.9K** -- Static balance, no interest accrual visible. Terms unknown (Question #4).

### 3H. StartEngine Funds ($42,787)

Two deposits from StartEngine in Apr-May 2025 totaling $42,787 are recorded to a "Start Engine" account. If this is equity crowdfunding (likely, given StartEngine's business model), this should be classified as equity, not income. There may also be securities law compliance obligations.

---

## 4. Internal Controls Assessment

### What Controls Exist
- Bank feeds appear to be connected (Shopify/Stripe/PayPal deposits auto-categorize)
- Bill pay flows through A/P for most vendors
- Payroll is processed through ADP

### What Controls Are Missing

| Control | Status | Risk |
|---------|--------|------|
| Revenue reconciliation (Shopify gross to QBO) | Missing | Revenue misstatement |
| COGS matching (inventory relief on shipment) | Missing | Inventory/COGS misstatement |
| Monthly bank reconciliation sign-off | Unknown | Cash misstatement |
| Credit card reconciliation | Missing for 3+ cards | Liability misstatement |
| Sales tax collection vs. remittance tracking | Missing | Tax liability exposure |
| Loan amortization schedules | Missing | Debt misstatement |
| Physical inventory counts | None documented | Inventory misstatement |
| Month-end close process | No evidence of one | Cumulative errors |
| Segregation of duties | N/A (one bookkeeper) | Acceptable for size |
| Journal entry review/approval | None visible | Misclassification risk |
| Chart of accounts maintenance | Inactive accounts not cleaned | Clutter, confusion |

### The Fundamental Process Gap

There is no **month-end close process**. A proper close would catch most of these issues because it forces:
1. Bank reconciliation completion
2. Revenue reconciliation to source systems
3. Inventory adjustment entries
4. Accrual entries for expenses incurred but not paid
5. Loan balance reconciliation to statements
6. Review of aging reports (AR and AP)

---

## 5. Recommended Fixes (Prioritized)

### Priority 1: Immediate (Weeks 1-4)

**1A. Establish Gross Revenue Recording**
- Change Shopify bank feed rules to split each payout into: Gross Revenue, minus Fees (expense), minus Refunds (contra-revenue), minus Tax Collected (liability), minus Shipping (revenue or liability depending on treatment)
- The Shopify payout summary report provides this breakdown for every payout
- Apply the same logic to Stripe, PayPal, and Amazon
- **Impact:** Corrects the single largest misstatement in the books

**1B. Implement Inventory Relief**
- Establish a monthly journal entry to relieve Inventory Asset and debit COGS based on units shipped
- Use the Shopify order data (which shows SKUs shipped) matched against the legacy MONSTERBASS cost data (which has unit costs)
- If unit-level costing is too complex initially, use a blended cost percentage applied to monthly revenue
- **Impact:** Corrects the second largest misstatement; makes gross margin visible

**1C. Reconcile Loan Balances**
- Obtain current statements for SBA 7a and SBA EIDL
- Adjust balance sheet to actual outstanding principal
- Split monthly payments between principal and interest
- Verify Shopify Capital remaining balance against Shopify admin
- **Impact:** Corrects liability misstatement; may improve net equity by $60-$100K

### Priority 2: Near-Term (Weeks 4-8)

**2A. Reconcile and Restate Credit Cards**
- Obtain current statements for Amex, Chase, and Visa cards
- Determine if Brex is still active or settled
- Update balances to actual; record any write-offs or settlements
- Set up bank feed rules for any active cards

**2B. Establish Sales Tax Tracking**
- Create a Sales Tax Payable liability account
- Record tax collected from Shopify (available in payout data)
- Reconcile against tax filings/payments made
- Determine if there is any unfiled/unpaid exposure

**2C. Classify StartEngine Funds**
- Confirm whether these are equity crowdfunding proceeds
- If equity: reclassify from income to equity
- Document any investor reporting obligations

**2D. Clarify Executive Pay Treatment**
- Determine if the $250K is distributions, deferred comp, or something else
- Reclassify appropriately
- Consider tax implications with CPA

### Priority 3: Ongoing Process (Weeks 8-12)

**3A. Implement Month-End Close Checklist**
- Bank reconciliation (all accounts)
- Revenue reconciliation (each channel gross-to-QBO)
- Inventory adjustment entry
- Loan balance verification
- AP aging review
- Credit card reconciliation
- Accrual entries for known expenses
- Manager review/sign-off

**3B. Clean Up Chart of Accounts**
- Inactivate unused accounts (there are numerous zero-balance legacy accounts)
- Standardize naming conventions
- Ensure proper account hierarchy (revenue accounts, COGS accounts, expense accounts clearly separated)

**3C. Document Accounting Policies**
- Revenue recognition policy (when revenue is recorded, how channels are handled)
- Inventory costing method (FIFO recommended)
- Capitalization thresholds
- Related party transaction documentation (Maximus Outdoors)

---

## Summary of Financial Statement Impact

If all corrections were made, the restated financials would show approximately:

| Line Item | Currently Shows | Estimated Restated | Direction |
|-----------|----------------|-------------------|-----------|
| Revenue (24mo) | ~$3.5M (all channels, net) | ~$4.2M+ (gross) | Higher |
| COGS | $43.6K | $1.4-1.8M | Much Higher |
| Gross Profit | Not meaningful | $2.0-2.4M (est 50-60% margin) | Now Visible |
| Processing Fees | $0 | $100-120K | New Expense |
| Operating Expenses | ~$213K (MONSTERBASS class only) | $800K+ (including allocated overhead) | Higher |
| Net Income | ($257K per P&L class) | ($400-600K estimated) | Larger Loss |
| Inventory | $1.294M | $200-400K (est) | Much Lower |
| Total Debt | $1.03M (stale) | $850-950K (updated) | Slightly Lower |
| Equity | ($959K) | ($1.2-1.5M) | Larger Deficit |

The net effect of restatement would show a company with **higher revenue, proper gross margins, larger operating losses, and lower net assets** than currently reported. This is actually a more useful picture for decision-making: it shows the real unit economics and the true cash needs of the business.

---

## Closing Note

These findings are consistent with what we typically see in growing D2C companies that started with basic bookkeeping and never upgraded their accounting infrastructure as the business scaled. The bookkeeper is doing a reasonable job of tracking cash flows -- bank deposits match, payments are recorded, payroll runs correctly. The gap is in the accrual accounting layer: recognizing revenue when earned (not when deposited), matching costs to the revenue they generate, and maintaining balance sheet accounts at their true balances.

The good news is that all of the source data exists (Shopify has detailed order/payout records, the legacy books have SKU costs, bank statements are available). This is a restatement and process improvement project, not a data reconstruction project.
