# atmix Audit Methodology
## Technical Documentation for Controllers and CFOs

This document explains how atmix analyzes financial data and reaches conclusions. Each section describes what the system examines, how it interprets data, and what triggers specific findings.

---

## Overview: LLM-First Architecture

atmix uses a fundamentally different approach from traditional rule-based audit software:

| Traditional Software | atmix LLM-First |
|---------------------|-----------------|
| Pre-defined rules match patterns | LLM understands context and meaning |
| Fixed thresholds trigger alerts | Dynamic assessment based on business type |
| Generic findings regardless of industry | Findings tailored to business context |
| Unable to learn or adapt | Researches unknown platforms on-the-fly |

**Core Principle**: Python handles file I/O. The LLM handles all analytical intelligence.

---

## Phase 0: Business Context Gathering

### What We Ask and Why

Before any analysis begins, we gather business context through targeted questions:

| Question | Why We Ask | How It Changes Analysis |
|----------|-----------|------------------------|
| Business type | Determines expected patterns | Service vs. e-commerce have different norms |
| Sales system | Identifies revenue sources | Affects platform reconciliation approach |
| Payment processors | Maps money flows | Identifies fees to expect |
| Has inventory? | Determines COGS relevance | Affects cost analysis entirely |
| Recurring revenue? | Sets accrual expectations | Changes revenue recognition analysis |

### Data Gap Analysis

After context gathering, we compare what we have vs. what we need:

```
For e-commerce business:
  EXPECTED: Bank statements, P&L, Balance Sheet, Platform reports (Shopify/Amazon)
  MISSING:  Platform payout reports
  IMPACT:   Cannot verify platform fees, may miss revenue discrepancies
```

**Blocking Gaps**: Data so critical that proceeding would produce misleading results
**High Priority Gaps**: Significantly impacts accuracy but can proceed with caveats
**Medium/Low Gaps**: Would improve analysis but not essential

---

## Phase 1: Data Ingestion

### File Type Detection

| Pattern | Detected As | How We Verify |
|---------|-------------|---------------|
| `*pl*.csv`, `*profit*.xlsx` | Profit & Loss | Contains revenue/expense line items |
| `*balance*.csv`, `*bs*.xlsx` | Balance Sheet | Contains assets/liabilities/equity |
| `*gl*.csv`, `*ledger*.xlsx` | General Ledger | Transaction-level detail with accounts |
| `*bank*.csv` | Bank Statement | Date, description, amount columns |

### Sample Extraction

For each file, we extract:
- First 50-100 rows for pattern detection
- Column headers for structure understanding
- Date ranges for period determination
- Unique values for category analysis

---

## Phase 2: Intelligent Planning

### How the LLM Decides What to Analyze

The LLM creates an analysis plan based on:

1. **What data is available** - Can't analyze AR if no receivables data
2. **Business type context** - E-commerce needs platform reconciliation; service needs nothing
3. **Detected anomalies** - Opening balance equity triggers equity investigation
4. **Industry norms** - Compares against expected patterns for business type

### Example Analysis Plan Generation

```
INPUT:
  Files: P&L, Balance Sheet, General Ledger
  Business Type: Online content creator
  Context: "Books inherited from bad accountant"

LLM REASONING:
  "This is a content creator, not e-commerce, so inventory and
   COGS analysis is irrelevant. Key concerns for this business:
   - Revenue classification (courses vs subscriptions vs sponsors)
   - Contractor vs employee classification (common creator issue)
   - Platform payout reconciliation (PayPal, Amazon)
   - Opening balance equity (mentioned bad accountant)"

OUTPUT PLAN:
  1. Revenue Stream Analysis - classify income sources
  2. Worker Classification Review - check for misclassification
  3. Equity Account Investigation - resolve opening balance
  4. Cash Position Analysis - verify liquidity
```

---

## Phase 3: Analysis Execution

### How Each Finding is Generated

Every finding includes a **source reference** and **confidence level**. Here's how different analysis types reach conclusions:

### Revenue Analysis

| What We Look For | How We Detect It | Significance |
|-----------------|------------------|--------------|
| Revenue trends | Compare monthly/quarterly totals | Declining trend = sustainability risk |
| Revenue classification | Examine account names and patterns | "Sales" vs "Services" indicates tracking quality |
| Seasonal patterns | Month-over-month variance | High variance affects cash planning |
| Revenue concentration | % from single source | >50% = concentration risk |

**Example Finding Generation:**
```
DATA:
  Revenue Jan: $35,000
  Revenue Dec: $2,000

CALCULATION:
  Decline = ($35,000 - $2,000) / $35,000 = 94.3%

FINDING:
  Severity: CRITICAL
  Title: "Severe Revenue Decline Threatens Business Viability"
  Source: P&L lines containing "Sales", "Revenue", "Income"
  Confidence: HIGH (based on clear trend across 12 months)
```

### Worker Classification Analysis

| Red Flag | Detection Method | Why It Matters |
|----------|-----------------|----------------|
| Same person on payroll AND 1099 | Name matching across payment types | IRS penalty risk |
| Large regular payments to individuals | Recurring amounts to same payee | Possible employee treated as contractor |
| Benefits + contract payments | Person receiving both | Clear misclassification |

**Example Finding Generation:**
```
DATA:
  GL shows: "Payroll - Tiffany Nguyen: $8,995/month"
  GL shows: "Contract Labor - T. Nguyen: $1,500/month"

MATCHING:
  Same individual, different classifications

FINDING:
  Severity: HIGH
  Title: "Worker Misclassification Creates Tax Compliance Risk"
  Source: GL entries containing payroll + contract labor
  Related Accounts: Payroll Expense, Contract Labor
```

### Balance Sheet Analysis

| Analysis | What We Examine | Threshold/Trigger |
|----------|----------------|-------------------|
| Opening Balance Equity | OBE account balance | Any non-zero amount |
| Negative Asset Balances | Asset accounts with negative values | Any negative |
| Unclassified Items | "Other", "Miscellaneous", "Ask Accountant" | >5% of category |
| Liquidity | Cash + receivables vs short-term liabilities | Ratio < 1.0 |

**Example Finding Generation:**
```
DATA:
  Opening Balance Equity: $227,005

INTERPRETATION:
  OBE should be $0 in a properly set up QuickBooks file.
  Large balance indicates:
  - Improper initial setup
  - Unclassified transactions
  - Missing historical data

FINDING:
  Severity: HIGH
  Title: "Opening Balance Equity Distorts Financial Position"
  Source: Balance Sheet, Equity section
  Impact: Financial statements unreliable until resolved
```

### Cash Position Analysis

| Metric | Calculation | Warning Threshold |
|--------|-------------|-------------------|
| Cash Burn Rate | (Beginning Cash - Ending Cash) / Months | >20% of revenue |
| Runway | Current Cash / Monthly Expenses | <3 months |
| True Liquidity | Total Cash - Negative Account Balances | Significantly different from reported |

**Example Finding Generation:**
```
DATA:
  Checking: $43,155
  Amazon Credit: -$11,118
  High Yield Savings: -$29,637

CALCULATION:
  Reported Cash: $43,155
  True Position: $43,155 - $11,118 - $29,637 = $2,400
  Overstated By: $40,755

FINDING:
  Severity: HIGH
  Title: "True Cash Position Overstated by $40,755"
  Source: Balance Sheet, Asset accounts
  Note: Negative balances indicate misclassified liabilities
```

---

## Phase 4: Quality Validation

### Automated Checks

Before findings are presented, we verify:

| Check | Requirement | Purpose |
|-------|-------------|---------|
| Source Citations | Every finding has file:row reference | Audit trail |
| Coverage | Key areas analyzed (liquidity, profitability, etc.) | Completeness |
| Consistency | No contradicting findings | Accuracy |
| Minimum Findings | At least 10 findings generated | Thoroughness |

### Confidence Scoring

Each finding carries a confidence level:

| Level | Meaning | Example |
|-------|---------|---------|
| HIGH | Direct observation, clear data | Revenue is $X in December |
| MEDIUM | Inference from patterns | Classification appears incorrect |
| LOW | Contextual guess, limited data | May indicate personal expenses |

---

## Phase 4.5: Investigation (Optional)

### How We Identify Follow-Up Needs

After initial analysis, the LLM evaluates:

1. **Findings that need verification** - "Revenue declined 95%" → Ask why
2. **Missing context** - Platform detected but no platform reports
3. **Ambiguous situations** - Payments could be personal or business

### Question Priority Levels

| Priority | When Assigned | Example |
|----------|--------------|---------|
| BLOCKING | Cannot complete meaningful audit without | "Is this your only business bank account?" |
| HIGH | Significantly impacts findings | "What caused the December revenue drop?" |
| MEDIUM | Would improve confidence | "How many states do you have sales tax nexus in?" |
| LOW | Nice to have | "Do you plan to add employees this year?" |

### Document Requests

We request specific documents when:
- Platform reconciliation is impossible without reports
- Worker classification needs verification
- Complex transactions require supporting documentation

Example:
```
DETECTED: PayPal payments, no PayPal statements
REQUEST: "PayPal Activity Report (Settings → Reports → All Transactions)"
WHY: "Need to verify PayPal fees match GL and no transactions missing"
```

---

## Phase 5: Synthesis

### How We Rank Findings

Findings are curated and ranked based on:

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Financial Impact | 40% | Dollar amount affected |
| Compliance Risk | 30% | IRS/regulatory exposure |
| Business Continuity | 20% | Affects ongoing operations |
| Confidence Level | 10% | How certain we are |

### Narrative Generation

Each curated finding receives a business narrative:

**Before** (raw finding):
> "Opening Balance Equity: $227,005"

**After** (synthesized narrative):
> "A large opening balance equity of $227,005 indicates improper QuickBooks setup and unclassified beginning balances. This prevents accurate financial reporting and could indicate unreported owner contributions or draws. Financial statements are unreliable until this is properly reclassified to appropriate equity accounts."

### Executive Summary Construction

The executive summary combines:
1. Overall assessment (Good/Needs Attention/Concerning/Critical)
2. Top 3-5 most impactful findings
3. Immediate action items
4. Risk level characterization

---

## Pricing Analysis Methodology

For new client pricing, we analyze:

### Complexity Factors

| Factor | Assessment Method | Impact on Pricing |
|--------|------------------|-------------------|
| Monthly Transactions | Count from GL, extrapolate | Base pricing driver |
| Account Count | Distinct bank/CC accounts | >5 suggests Professional tier |
| Platform Count | Detected integrations | Each adds reconciliation work |
| AR/AP Volume | Invoice/bill transactions | >30/month suggests Professional |
| Accrual Needs | Prepaid, deferred revenue patterns | Indicates Elite tier |
| Cleanup Backlog | Months with unreconciled transactions | One-time fee calculation |

### Tier Selection Logic

```
IF needs_accrual OR accounts > 10 OR monthly_transactions > 1000:
    → ELITE ($2,000-5,000/month)

ELIF needs_ar_ap OR accounts > 5 OR monthly_transactions > 500 OR platforms > 1:
    → PROFESSIONAL ($1,250-2,000/month)

ELSE:
    → ESSENTIAL ($750-1,250/month)
```

### Within-Tier Pricing

Price within the tier range based on:
- Transaction volume (higher = higher price)
- Complexity factors (more = higher price)
- Cleanup state (messier = higher startup costs)

---

## Understanding Confidence Levels

### What Affects Confidence

| Factor | Effect on Confidence |
|--------|---------------------|
| Complete data for period | ↑ Increases |
| Consistent patterns | ↑ Increases |
| User verification | ↑ Increases |
| Missing files | ↓ Decreases |
| Anomalies without explanation | ↓ Decreases |
| Single source of information | ↓ Decreases |

### How to Interpret Confidence

| Score | Interpretation | Recommended Action |
|-------|----------------|-------------------|
| 85-100% | High confidence, well-supported | Act on findings |
| 70-85% | Good confidence, some gaps | Verify key assumptions |
| 50-70% | Moderate confidence | Request additional data |
| <50% | Low confidence | Findings need verification |

---

## Limitations and Caveats

### What atmix Cannot Do

1. **Access live banking data** - Works only with provided exports
2. **Verify physical inventory** - Cannot count or inspect goods
3. **Confirm third-party information** - Cannot verify customer/vendor data
4. **Provide legal/tax advice** - Identifies issues, doesn't prescribe solutions
5. **Guarantee completeness** - Only as good as data provided

### When to Question Findings

- Finding contradicts known business reality
- Confidence level is below 70%
- Finding based on single data point
- Business context wasn't fully provided

---

## Report Delivery

### Standard Outputs

| Document | Purpose | Audience |
|----------|---------|----------|
| Executive Summary (MD) | High-level findings | Business owners, executives |
| Executive Report (HTML) | Detailed findings with charts | Controllers, CFOs |
| Questions List (MD) | Items needing management response | Operations team |
| Synthesis Data (JSON) | Raw data for further analysis | Technical users |

### How to Use the Findings

1. **Review Executive Summary** for overall assessment
2. **Prioritize CRITICAL and HIGH findings** for immediate action
3. **Answer outstanding questions** to improve next analysis
4. **Provide requested documents** to fill gaps
5. **Work with accountant/CPA** to implement corrections

---

*Document Version: 3.0*
*Generated for atmix v3 LLM-First Audit System*
