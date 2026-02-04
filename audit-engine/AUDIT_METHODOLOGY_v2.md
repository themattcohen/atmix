# atmix v2: Audit Methodology for Financial Professionals

A comprehensive guide for controllers, CFOs, and financial professionals explaining how the atmix v2 LLM-first audit system reaches its conclusions.

---

## Executive Overview

atmix v2 is an AI-powered financial audit system that uses Claude (a large language model) to analyze your financial data. Unlike rule-based systems that apply rigid thresholds, atmix uses intelligent analysis that adapts to your specific business context.

**Key Principle**: The system asks questions first, analyzes second. Before crunching numbers, it needs to understand your business.

---

## How the Audit Works: Phase by Phase

### Phase 0: Business Context Gathering

**What Happens**: Before any analysis begins, the system interviews you about your business.

**Why This Matters**:
- PayPal transactions in your P&L could mean "PayPal as a payment method within Shopify" OR "PayPal as a separate sales channel" - the analysis differs dramatically
- A 40% gross margin might be excellent for manufacturing but concerning for SaaS
- Missing data has different implications depending on business type

**Questions Typically Asked**:
| Question Type | Example | Why It Matters |
|---------------|---------|----------------|
| Business Type | "Is this an e-commerce, SaaS, services, or manufacturing business?" | Determines which metrics and benchmarks apply |
| Sales Platform | "What is your primary sales system (Shopify, QuickBooks POS, Salesforce, etc.)?" | Helps interpret payment processor entries in P&L |
| Payment Methods | "What payment processors do you use, and are they separate channels or methods within a platform?" | Prevents misclassifying payment methods as revenue channels |
| Inventory | "Do you hold inventory?" | Determines whether COGS and inventory turnover analysis is relevant |
| Revenue Model | "Is revenue primarily one-time sales, subscriptions, or project-based?" | Shapes cash flow and revenue recognition analysis |

**How Answers Are Used**:
Your answers are incorporated into every subsequent analysis prompt. The LLM is explicitly instructed not to contradict your stated business context.

---

### Phase 0.5: Data Gap Analysis

**What Happens**: The system identifies what data is missing and assesses the impact on analysis quality.

**How Missing Data Is Detected**:

1. **Business-Type Expectations**: Based on your business type, the system knows what data should exist:

   | Business Type | Expected Data | Example Gap |
   |---------------|---------------|-------------|
   | E-commerce (Shopify) | Transaction-level sales, refunds, customer data | Only seeing P&L totals, no order detail |
   | SaaS | MRR/ARR breakdown, churn data, cohort analysis | Only seeing revenue totals, no subscription metrics |
   | Professional Services | Project list, time billing, WIP | Only seeing total revenue, no engagement detail |
   | Manufacturing | Bill of materials, inventory aging, production costs | Only seeing COGS totals, no component breakdown |

2. **Gap Priority Levels**:
   - **Blocking** 🔴: Cannot produce meaningful audit without this data
   - **High** 🟠: Significantly limits analysis accuracy
   - **Medium** 🟡: Would add valuable insight
   - **Low** 🟢: Nice to have for completeness

**What You See**:
A report showing:
- What data IS available
- What data is MISSING
- Impact of each gap on specific analyses
- Recommendation to proceed or gather more data

**Your Decision Point**:
You can choose to:
1. **Proceed** with limitations clearly noted in the final report
2. **Pause** to gather additional data and restart

---

### Phase 1.5: Data Preparation

**What Happens**: Large files (500+ rows) are intelligently processed to extract meaningful summaries.

**Why This Is Needed**:
- A 10,000-row general ledger is too large to analyze efficiently
- Raw transaction data needs aggregation for financial analysis
- The LLM works better with structured summaries than raw dumps

**Processing Strategies**:

| Strategy | When Used | Example |
|----------|-----------|---------|
| **Aggregate** | High-volume transaction data | Sum GL entries by account and period |
| **Filter** | Data with irrelevant rows | Extract only customer-facing transactions |
| **Sample** | Uniform data needing spot-checks | Random sample of 500 transactions for pattern detection |
| **Extract** | Complex data with key sections | Pull summary sections from detailed reports |

**How Strategies Are Chosen**:
The LLM analyzes:
- File schema (columns present)
- Sample of first 50 rows
- Your stated business context

Then decides the optimal processing approach for each file.

**Output**:
Derived files in a `derived/` folder that are used for analysis instead of raw large files.

---

### Phase 2: Analysis Planning

**What Happens**: The LLM creates a customized analysis plan based on your data and business context.

**Planning Considerations**:

1. **Data Available**: What statements are present (P&L, Balance Sheet, GL, etc.)
2. **Business Type**: What analyses are most relevant
3. **Known Gaps**: What analyses are limited by missing data
4. **Red Flags**: What areas warrant deeper investigation based on data samples

**Typical Planned Analyses**:

| Analysis Type | Questions Answered | Required Data |
|---------------|-------------------|---------------|
| **Liquidity** | Can you meet short-term obligations? Cash runway? | Balance Sheet, Bank Statements |
| **Profitability** | Are margins healthy? Cost structure issues? | P&L |
| **Revenue** | Channel performance? Customer concentration? | P&L, Sales Detail |
| **Cash Flow** | Operating vs. financing cash flow? Burn rate? | GL, Bank Statements |
| **Working Capital** | AR/AP aging? Inventory turnover? | Balance Sheet, AR/AP Aging |
| **Debt & Leverage** | Debt-to-equity? Coverage ratios? | Balance Sheet |

**What You Approve**:
Before analysis begins, you see:
- Each planned analysis with rationale
- Priority level (high/medium/low)
- Data required
- Questions it will answer
- Known limitations due to data gaps

You can modify, add, or reject analyses.

---

### Phase 3: Analysis Execution

**What Happens**: Each approved analysis is executed by the LLM, generating findings with supporting evidence.

**How Analysis Works** (the "black box" explained):

For each analysis, the LLM:

1. **Receives Context**:
   - Your business type and context
   - Relevant data files (processed)
   - Prior findings from other analyses
   - Specific questions to answer

2. **Performs Calculations**:
   The LLM calculates standard financial metrics. Examples:

   | Metric | Calculation | Interpretation |
   |--------|-------------|----------------|
   | Current Ratio | Current Assets ÷ Current Liabilities | \>1.0 generally healthy, \<1.0 may indicate liquidity stress |
   | Quick Ratio | (Current Assets - Inventory) ÷ Current Liabilities | More conservative liquidity measure |
   | Gross Margin | (Revenue - COGS) ÷ Revenue | Varies by industry; consistency matters |
   | Inventory Turnover | COGS ÷ Average Inventory | Higher = faster inventory movement |
   | Days Sales Outstanding | (AR ÷ Revenue) × 365 | Days to collect payment |
   | Debt-to-Equity | Total Liabilities ÷ Total Equity | Leverage indicator |

3. **Identifies Patterns**:
   - Month-over-month trends
   - Unusual variances from averages
   - Relationships between accounts (e.g., revenue vs. corresponding AR)
   - Seasonal patterns

4. **Generates Findings**:
   Each finding includes:
   - **Title**: Clear description of what was found
   - **Severity**: Critical, High, Medium, Low, Info
   - **Source**: Specific file and data reference
   - **Value**: The actual number/observation
   - **Business Implication**: Why this matters
   - **Confidence**: High, Medium, Low with rationale

**Example Finding**:
```
Title: Credit Card Debt Exceeds Cash Reserves by 3.3x
Severity: Critical
Source: balance_sheet.csv (December 2025)
Value: Credit cards $332K vs Cash $100K
Implication: Reliance on high-interest financing; credit limit
             restrictions could halt operations
Confidence: High - verified against multiple periods
```

---

### Phase 4: Quality Validation

**What Happens**: Automated and LLM-based checks verify analysis quality.

**Validation Checks**:

| Check | What It Verifies | Failure Action |
|-------|------------------|----------------|
| **Completeness** | All planned analyses completed | Flag incomplete analyses |
| **Source Citation** | Every finding references specific data | Flag unsupported claims |
| **Coverage** | Key areas addressed (liquidity, profitability, etc.) | Identify analysis gaps |
| **Contradiction** | Findings don't contradict each other | Flag for review |
| **Minimum Findings** | At least 10 findings generated | Indicates shallow analysis |

**Validation Score**:
A percentage score indicating analysis quality. Below 70% triggers additional review.

**What You Approve**:
All findings grouped by severity, with:
- Source citations
- Validation results
- Any detected contradictions or gaps

You can request additional analysis or reject findings.

---

### Phase 5: Synthesis & Narrative Generation

**What Happens**: Raw findings are curated, ranked, and transformed into executive narratives.

**Curation Process**:

1. **Ranking**: Findings sorted by business impact, not just severity
2. **Grouping**: Related findings combined into themes
3. **Deduplication**: Overlapping findings merged
4. **Narrative Writing**: Technical findings converted to business language

**Narrative Transformation Example**:

*Before (raw finding)*:
> Current ratio 0.35 (current assets $383K / current liabilities $1.09M)

*After (narrative)*:
> Working Capital Deficit of $704K Threatens Operations. Current assets of $383K cannot cover current liabilities of $1.09M, indicating inability to meet short-term obligations without additional financing or asset liquidation.

**Visualizations Generated**:
The system creates Chart.js configurations for:
- Trend charts (revenue, margins over time)
- Composition charts (expense breakdowns)
- Comparison charts (actual vs. benchmark)

**What You Approve**:
- Executive summary narrative
- Top 10-15 curated findings with business narratives
- Proposed visualizations
- Questions for management
- Document request list

---

### Phase 6: Report Generation

**What Happens**: Final reports are generated in multiple formats.

**Output Files**:

| File | Audience | Content |
|------|----------|---------|
| `Executive_Report.html` | C-Suite | Interactive dashboard with charts |
| `Executive_Summary.md` | Board/Stakeholders | Narrative summary with key findings |
| `Questions_List.md` | Management | Prioritized questions requiring answers |
| `synthesis_data.json` | Technical | Raw data for further analysis |

---

## Business Type Adaptations

atmix adapts its analysis based on your business type:

### E-Commerce

**Key Metrics Prioritized**:
- Revenue by channel (if transaction data available)
- Shipping costs as % of revenue
- Refund/chargeback rates
- Customer acquisition cost (if marketing data available)
- Platform fees analysis

**Common Gaps Flagged**:
- Transaction-level sales data (order detail)
- Customer cohort data
- Product-level margin data

### SaaS / Subscriptions

**Key Metrics Prioritized**:
- MRR/ARR trends
- Churn rate (if data available)
- Revenue per customer
- Customer lifetime value indicators
- R&D spending ratio

**Common Gaps Flagged**:
- Subscription detail data
- Churn/retention reports
- Customer segmentation

### Professional Services

**Key Metrics Prioritized**:
- Revenue per employee
- Utilization rate (if time data available)
- Project profitability
- WIP aging
- Client concentration

**Common Gaps Flagged**:
- Time and billing detail
- Project/engagement list
- Client revenue breakdown

### Manufacturing

**Key Metrics Prioritized**:
- Gross margin by product (if available)
- Inventory turnover
- COGS component breakdown
- Supplier concentration
- Production efficiency metrics

**Common Gaps Flagged**:
- Bill of materials
- Inventory aging
- Production cost detail

---

## Threshold Philosophy

Unlike rule-based systems with rigid thresholds, atmix uses **contextual assessment**:

| Approach | Rule-Based | atmix LLM-First |
|----------|------------|-----------------|
| Current Ratio | "Flag if \< 1.0" | "Assess in context of industry, trend, and cash flow timing" |
| Gross Margin | "Flag if \< 30%" | "Compare to stated business type norms; flag significant changes from trend" |
| AR Aging | "Flag if \> 90 days" | "Assess collection terms, industry norms, and customer concentration" |

**Severity Assignment**:

| Level | Criteria |
|-------|----------|
| **Critical** 🔴 | Threatens business continuity; requires immediate action |
| **High** 🟠 | Significant financial impact; requires near-term action |
| **Medium** 🟡 | Notable concern; should be addressed in planning |
| **Low** 🟢 | Minor issue; monitor and address opportunistically |
| **Info** 🔵 | Observation for awareness; no action required |

---

## Confidence and Limitations

Every audit report includes:

### Confidence Score
Overall confidence in the analysis based on:
- Data completeness
- Data quality
- Ability to verify calculations
- Consistency of findings

### Known Limitations
Explicitly stated limitations due to:
- Missing data (from gap analysis)
- Data quality issues detected
- Unable-to-verify assumptions

### Caveats
Specific cautions about conclusions, such as:
- "Revenue channel analysis limited to P&L categories due to missing transaction data"
- "Inventory turnover calculation uses year-end values; actual turns may differ"

---

## Questions?

The system is designed to be transparent about how conclusions are reached. Every finding in the report includes:
- **Source reference**: Where the data came from
- **Calculation method**: How values were derived
- **Confidence level**: How certain we are
- **Limitations**: What we couldn't analyze

If any finding seems unclear or questionable, request additional detail or re-analysis during the approval gates.

---

*atmix v2: LLM-First Financial Audit System*
*Designed for transparency and professional-grade financial analysis*
