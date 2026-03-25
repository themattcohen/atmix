# Cambium Carbon Controller Opportunity - Deep Analysis

**Prepared: 2026-03-18** | **Re-verified: 2026-03-18**

## Source Documents

This analysis is based on four documents received via zip file (`download (4).zip`, 3.2MB):

1. **Cambium - Entity Structure & Systems Reference.pdf** (13 pages, 312KB) — "NetSuite Implementation Onboarding Guide, March 2026, Confidential"
2. **Historical Financials & Projected Outlook.pdf** (15 pages, 2.9MB) — "Prepared as of 02/02/2026, Confidential"
3. **BFLC - Transaction List by Date - Dec 2025.xlsx** (177 rows) — exported from QBO, "Friday, March 13, 2026"
4. **Cambium Carbon PBC - Transaction List by Date - Dec 2025.xlsx** (1,143 rows) — exported from Intacct, "Friday, March 13, 2026"

Every claim below is tagged with its source. Claims marked **[INFERENCE]** are my analysis, not stated in any document. Claims marked **[NOT IN DOCS]** are context I'm adding from general knowledge — treat these as unverified.

---

## 1. WHAT THE COMPANY IS

**Source: Entity PDF, pages 1-5, 8-9**

**Cambium Carbon PBC** (Delaware C Corp) operates as a wood supply chain platform. "PBC" is in the legal name; the entity doc confirms the legal form is "Delaware C Corp" but does not explicitly state "Public Benefit Corporation." **[INFERENCE]** PBC in the name almost certainly means Public Benefit Corporation, but confirm this.

| Layer | What It Does | Revenue Model |
|-------|-------------|---------------|
| **Platform/SaaS** | Traece (mill inventory SaaS), Mill Market (marketplace connecting arborists/truckers/mills) | Subscriptions + transaction fees |
| **Logistics/Brokerage** | Millwork SC, Furniture SC, Mass Timber — orchestrates supply chain without taking title | Margin on facilitation |
| **Processing/Distribution** | Millwork Processing, Furniture Processing, Midwest Distribution — physical wood transformation and resale | Invoice for finished goods |

**Three legal entities** (Entity PDF p.8-9):

| Entity | Legal Name | Form | EIN | Role |
|--------|-----------|------|-----|------|
| Parent | Cambium Carbon PBC | Delaware C Corp | 86-1216859 | Primary operating entity, all employees |
| Sub 1 | Fallen Lumber Co ("Cambium East") | Maryland LLC | 87-4219677 | Processing + distribution (acquired) |
| Sub 2 | Intectural Inc ("Cambium Midwest") | Minnesota C Corp | 27-1823431 | Distribution only (acquired) |

Plus a "Cambium (Consolidated)" entity in NetSuite for roll-up reporting only — not a real legal entity (Entity PDF p.8).

**Entity doc states**: "Employees: All" and "Payroll: All (via Rippling)" for PBC; "Employees: None" and "Payroll: None" for both subsidiaries (Entity PDF p.9).

**Discrepancy found**: The entity doc says payroll is via **Rippling**, but actual bank transactions in both BFLC and PBC show payroll processed by **Paylocity**. Either Rippling routes through Paylocity, or the entity doc describes a future/planned state. Ask about this.

---

## 2. FINANCIAL REALITY CHECK

### Income Statement (2020-2025)

**Source: Financials PDF, page 8. Numbers below are exact from the document.**

| Year | Revenue | COGS | Gross Profit | GP% | OpEx | Other Inc/Exp | Net Income |
|------|---------|------|-------------|-----|------|---------------|------------|
| 2020 | $79,317 | ($9,883) | $69,434 | 87.5% | ($23,863) | — | $45,571 |
| 2021 | $276,654 | ($84,477) | $192,176 | 69.5% | ($601,532) | — | ($448,356) |
| 2022 | $1,394,707 | ($539,297) | $855,410 | 61.3% | ($2,740,583) | $117,337 | ($1,767,836) |
| 2023 | $1,452,506 | ($1,030,629) | $421,877 | 29.0% | ($3,487,110) | ($49,645)^1 | ($3,178,285) |
| 2024 | $1,989,325 | ($1,383,764) | $605,561 | 30.4% | ($4,358,238) | $5,220^2 | ($3,998,739) |
| 2025 | $10,027,832 | ($7,870,002) | $2,157,830 | 21.5% | ($8,882,142) | ($57,604)^3 | ($6,781,916) |

^1 2023: Other Income $10,645 + Other Expenses ($39,000) = ($28,355). Discrepancy vs stated net — possible rounding in PDF layout.
^2 2024: Other Income $128,916 + Other Expenses ($123,696) = $5,220
^3 2025: Other Income $482,594 + Other Expenses ($540,198) = ($57,604)

**Revenue breakdown by stream (Financials PDF p.8):**

| Stream | 2024 | 2025 | Growth |
|--------|------|------|--------|
| Wood Platform Sales | $1,024,878 | $7,830,567 | 664%^4 |
| Joint Development | $347,704 | $1,083,687 | 212% |
| Platform Fees | $616,743 | $1,113,578 | 81% |

^4 The Financials PDF (p.3) claims "Revenue grew 687% from 2024 to 2025" for Wood Platform Sales. Actual math: ($7,830,567 - $1,024,878) / $1,024,878 = 664%. Their stated 687% doesn't match their own numbers.

**Cumulative net losses 2020-2025**: $45,571 - $448,356 - $1,767,836 - $3,178,285 - $3,998,739 - $6,781,916 = **($16,129,561)**. Source: sum of Financials PDF p.8 net income figures.

### Margin Claims vs. Reality

**Source: Financials PDF, pages 3-5 (Definitions section)**

| Claim | Source | Verification |
|-------|--------|--------------|
| Wood Platform margin "29.04% current" | Financials PDF p.3 | Math: ($7,830,567 - $5,859,284) / $7,830,567 = 25.2%. **Does not match their 29.04% claim.** |
| "35%+ near term, 45%+ on mature flows" | Financials PDF p.3 | Forward-looking, unverifiable |
| "20% of 2025 deals > 50% margin" | Financials PDF p.3 | Stated as fact, unverifiable from provided data |
| "Amazon GES Furniture 53.08%, Room & Board Red Oak Sherrill 45.09%" | Financials PDF p.3 | Specific examples cited, unverifiable from provided data |
| Platform Fees "93% margin on net revenue basis under ASC 606" | Financials PDF p.5 | Currently reporting on GMV basis. ASC 606 shift is described as planned: "Moving from GMV to Net Revenue" |
| Platform Fees "7.07% when measured on a GMV basis" | Financials PDF p.5 | Math: ($1,113,578 - $1,107,302) / $1,113,578 = 0.6%. **Does not match their 7.07% claim.** Possible: COGS figure includes items not shown in annual summary. |
| Joint Development "29.40% margin" | Financials PDF p.4 | Math: ($1,083,687 - $903,415) / $1,083,687 = 16.6%. **Does not match their 29.40% claim.** |

**[INFERENCE]**: Multiple margin claims in the Definitions section don't match the income statement math on the same PDF. Either there are adjustments not shown, or the margins are aspirational rather than actual. This needs direct questioning.

### Balance Sheet (2025)

**Source: Financials PDF, page 10. Exact figures.**

| Item | 2024 | 2025 |
|------|------|------|
| Bank Accounts | $2,788,138 | $8,060,350 |
| Accounts Receivable | $479,318 | $2,195,789 |
| Inventory | $644,377 | $899,546 |
| Other Current Assets | $1,335,102 | $3,526,864 |
| Fixed Assets | $299,812 | $792,517 |
| Other Assets | $1,914,088 | $2,804,000 |
| **Total Assets** | **$7,460,836** | **$18,279,066** |
| Current Liabilities | $1,140,860 | $5,586,045 |
| Long-term Liabilities | $14,896,834 | $1,815,617 |
| Equity | ($8,576,859) | $10,877,403 |
| **Total L+E** | **$7,460,836** | **$18,279,066** |

**[INFERENCE] Equity analysis**: Equity swung from ($8,576,859) to $10,877,403 = $19,454,262 improvement. Adding back the $6,781,916 net loss implies approximately **$26.2M in equity raised** during 2025. Long-term liabilities dropped from $14.9M to $1.8M, suggesting ~$13.1M in convertible debt also converted to equity. This is a reasonable inference but the actual raise amount, terms, and structure are **not stated anywhere in the provided documents**.

**DSO calculation**: $2,195,789 AR / ($10,027,832 / 365) = **80 days**. [INFERENCE — calculated from Financials PDF p.8 and p.10]

**Invoiced vs. Revenue gap**: 2025 invoiced $12,401,327 (Financials PDF p.11) vs. revenue $10,027,832 (p.8) = $2.37M difference. **[INFERENCE]** Could be timing/deferred revenue or accrual basis differences. Not explained in the documents.

### Projections (2026-2030)

**Source: Financials PDF, page 14. Exact figures.**

| Year | Wood Platform | Joint Dev | Transaction Fees | Supply Chain OS | Total |
|------|-------------|-----------|-----------------|-----------------|-------|
| 2026 | $25,875,000 | $2,930,000 | $90,360 | $603,750 | $29,499,110 |
| 2027 | $62,625,000 | $6,439,500 | $5,616,020 | $17,154,000 | $91,834,520 |
| 2030 | $434,505,053 | $16,375,026 | $121,076,933 | $201,986,000 | $773,943,011 |

**[INFERENCE]**: That's 77x growth in 5 years from a company that just hit $10M. Supply Chain OS goes from $603K (2026) to $202M (2030) — this product does not currently generate standalone revenue per the Definitions section (p.6: "Most value is realized inside our own supply chains rather than as standalone revenue").

**Disclosed partner spend** (Financials PDF p.15): "$1.5B of planned spend through 2032. Over $400M is contractually exclusive to us, and another $389M Cambium is embedded directly into customer templates." **[INFERENCE]**: "Disclosed" and "planned" are their words. The distinction between disclosed, contracted, and exclusive is important — the $1.5B is not all committed revenue.

**The projections show revenue only, not expenses.** There is no projected P&L. [Verified — no expense projections exist in any provided document.]

---

## 3. DECEMBER 2025 TRANSACTION ANALYSIS

### BFLC (Fallen Lumber Co) — 177 transactions

**Source: BFLC Excel file. All figures verified by parsing the spreadsheet.**

| Category | Amount | Details |
|----------|--------|---------|
| Capital contribution from PBC | $155,000 | Account: "31000 Additional Paid in Capital - Cambium" |
| Payroll (Paylocity) | ($75,402) | 5 transactions: direct deposit + tax collection runs |
| Rent | ($21,550) | Account: 66600 Rent or Lease |
| Retirement benefits (AEGON) | ($16,628) | 3 transactions to "23430 Retirement Benefits Payable" |
| Ramp credit card payment | ($14,276) | Single payment |
| Contractor expense | $11,084 | 8 bills to 4 individuals (see below) |
| Utilities (BG&E) | ($5,123) | Account: 66750 Utilities |
| AR collections | $5,329 | 3 payments received |
| **Net total** | **$28,253** | Per spreadsheet TOTAL row |

**Contractor detail** (verified hourly rates from bill memos):

| Name | Period 1 (11/24-12/05) | Period 2 (12/08-12/19) | Implied Rate |
|------|----------------------|----------------------|-------------|
| Noah Bennett | $480 (32 hrs) | $600 (40 hrs) | $15/hr |
| Raymond M Miller Jr | $1,088 (56 hrs) | $1,600 (80 hrs) | $19.43-20/hr |
| Moises Guzman | $1,260 (63 hrs) | $1,440 (72 hrs) | $20/hr |
| Lambo Ramirez | $2,308 (hrs not stated) | $2,308 (hrs not stated) | Unknown |

**Key finding**: The entity doc (p.9) states Cambium East has "Employees: None" and "Payroll: None." But the BFLC bank transactions show:
- **$75,402 in payroll** processed through Paylocity (with "BALTIMORE FALLEN LUMBE" in the memo)
- **$16,628 in retirement benefits** paid to AEGON
- **$563 in payroll processing fees** to Paylocity

This is a direct contradiction. Either the entity doc is wrong (BFLC does have employees), or payroll is being run through BFLC's bank account for PBC employees who work at the Baltimore location. Ask which it is.

### Cambium Carbon PBC — 1,143 transactions

**Source: PBC Excel file. All figures verified by parsing the spreadsheet.**

**Top outflows by vendor (absolute amounts):**

| Vendor | Amount | What |
|--------|--------|------|
| Paylocity | $478,840 | Payroll (direct deposit + tax collection) |
| Ascend (Guilford) | $474,470 | Internal bank transfers (Ascend checking to Ascend accounts) |
| Rock Creek Tree, Turf & Landscape | $372,962 | Wood Platform deal |
| National Links Trust | $372,962 | Wood Platform deal (same amount — possibly related to same project) |
| Parton Lumber Company | $312,699 | Lumber supplier (COGS — yellow pine) |
| Frisco Woodline Mill | $283,850 | Includes $137,300 for "Weinig, Nederman, and Air Compressor" (machinery via COGS account) + other materials |
| Ascend Bank | $320,000 | LOC drawdown (account 21600 Ascend Line of Credit 0267) |
| Baltimore Fallen Lumber LLC | $155,000 | Intercompany capital contributions (account: 17100 Investment in BFL) |
| Intectural Inc. | $104,636 | Intercompany: $100K investment + $4,636 in AP |
| RT Machine Company | $93,476 | Account: "19000 Machinery & Equipment" |
| BFL Acquisition Loan Payment | $87,188 | 2 payments of $43,594 each (account: 17100 Investment in BFL) |
| Ramp | $91,335 | Credit card payments and clearing |
| Tipalti Inc | $68,193 | Mill Market seller disbursements (BofA 3490 → Tipalti) |

**Top inflows:**

| Source | Amount | What |
|--------|--------|------|
| SmartLam North America | $372,891 | AR collection — Mass Timber customer |
| AR collections (various) | $654,770 | Total AR credits in period |
| Undeposited Funds | $196,625 | Payments clearing |

**Intercompany detail** (from PBC's perspective):

| Recipient | Total Outflow | Breakdown |
|-----------|--------------|-----------|
| Baltimore Fallen Lumber / BFL | $263,451 | $155K capital contributions + $87K acquisition loan payments + $21K GPT Santa Fe Springs (tagged to BFL investment account) |
| Intectural Inc | $104,636 | $100K investment + $4,636 AP |

Note: The previous version of this analysis stated "$155K sent to BFLC." That's what BFLC received as capital contributions, but PBC's total BFL-related outflows were **$263K** in December when including acquisition debt service.

**567 Ramp expense transactions totaling $1,141,193** — verified from Excel (Expense type: 567 rows, sum: -$1,141,193.10).

**Net total: $1,755,849** — per spreadsheet TOTAL row. (Previous version rounded to "$1.76M" — accurate.)

---

## 4. ERP & OPERATIONAL CONTEXT

### Current Systems State

**Source: Entity PDF, pages 2, 6-7, 10-11**

The entity doc is explicitly titled "NetSuite Implementation Onboarding Guide" and states it "consolidates information previously spread across internal SOPs into a single onboarding reference." This document was written FOR a NetSuite consultant.

**Current ERP landscape** (Entity PDF p.2, 10):
- Cambium Carbon PBC: **Sage Intacct** — [INFERENCE from transaction export format and entity doc's mention of "current" systems. Entity doc p.10 lists "ERP / PO: NetSuite" for all entities, which describes the target state, not current.]
- Cambium East (BFLC): **QuickBooks Online** — [Verified: BFLC Excel header says "Transaction List by Date" in QBO export format, and transactions reference QBO-specific account structures like "Bill.com Money Out Clearing"]
- Cambium Midwest (Intectural): **[NOT CONFIRMED]** — No Intectural transaction data was provided. Previous analysis assumed QBO but this is unverified.

**NetSuite contract** (Entity PDF p.11 — exact figures):
- Total annual: $58,483.80
- 19 general access user seats
- SuiteSuccess Standard, SuiteProjects, Premium Support (24x7)
- Analytics Warehouse Standard + 5-user pack + Sandbox
- Term: September 2025 through September 2026
- Sales rep: Meghan McManus (Oracle)

**[INFERENCE]**: The NetSuite contract is already active (Sep 2025), meaning they're paying for a system they may not be fully using yet. The onboarding guide being dated March 2026 — 6 months into the contract — suggests implementation is behind schedule or just starting.

### Nine Business Units

**Source: Entity PDF, pages 3-5. Exact complexity scores and details.**

| BU | Zone | Complexity (X,Y) | Revenue Size | Manager |
|----|------|-------------------|-------------|---------|
| Millwork Processing | Processing | 9.5, 9.5 | Large | Jeff C |
| Furniture Processing | Processing | 9.5, 8.5 | Medium | Seth E |
| Millwork Supply Chain | Logistics | 5.5, 7.5 | Large | Jeff C |
| Furniture Supply Chain | Logistics | 5.5, 6.5 | Medium | Seth E |
| Midwest Distribution | Distribution | 7.5, 5.0 | Medium | Jeff C |
| Mass Timber | Logistics | 5.5, 4.0 | Large | Charles G |
| Joint Development | Advisory | 2.5, 2.5 | Medium | Alicia B |
| Mill Market | Marketplace+ | 3.5, 2.0 | Medium | Ryan G (full name: Ryan Glossup, per p.4) |
| Traece | Platform/SaaS | 1.0, 1.0 | Very Small | Joe M (full name: Joe McDonald, per p.4) |

**Invoice manager for Millwork Processing, Furniture Processing, and Mass Timber: Nicole K** (Entity PDF p.4).

Processing COGS structure (Entity PDF p.4): "Raw green lumber, 3rd party initial delivery, 3rd party labor, dryer delivery, in-house surfacing labor, gang rip, waste labor, 3rd party final delivery, additional labor, and transaction fees."

Millwork Processing is described as "Hardest BU in the portfolio across every dimension" with "Inputs do not equal outputs: yield loss, grade variability, waste." 60% in-house at Cambium East, 40% external. (Entity PDF p.4)

### Four Service Scopes

**Source: Entity PDF, page 5**

| Scope | Definition |
|-------|-----------|
| Broker | Transacts, never touches product |
| Distribute | Purchases finished product, resells |
| Secondary Processing | Purchases rough dry lumber, adds value (surfacing, ripping, molding) |
| Primary Processing | Purchases rough green lumber, dries, grades, then secondary processing |

### Banking Structure

**Source: Entity PDF, page 12. 13 accounts listed.**

| Institution | Last 4 | Type | Purpose | Notes |
|-------------|--------|------|---------|-------|
| Bank of America | 3461 | Checking | Future primary operating | |
| Bank of America | 3490 | Checking | Mill Market operating | Tipalti pulls from here |
| Merrill Lynch | 2368 | Savings | Investment/transition | Replacing Ascend 2179 |
| Ascend | 4110 | Checking | Current primary operating | Payroll, cards, AP |
| Ascend | 3740 | Savings | Legacy | **Scheduled for closure** |
| Ascend | 2179 | Checking | Cash reserves / money market | |
| Ascend | 3488 | Time Deposit | LOC collateral (2% interest) | Backs LOC 0267 |
| Ascend | 0267 | LOC | Secured line of credit | Backed by 3488 |
| Amalgamated | 3262 | Checking | Legacy operating | **Scheduled for closure** |
| Tipalti | 0115 | Disbursement | Seller payments | Draws from BofA 3490 |
| Atlantic Union | 4410 | Checking | BFLC primary operating | |
| NBOC | 2219 | Checking | Intectural primary operating | |
| NBOC | 2595 | LOC | Intectural line of credit | |

"Ascend 3488 cannot be liquidated until 0267 is paid off." (Entity PDF p.12)

### COA Naming Discrepancy

**Source: Comparing PBC Excel account names vs. Financials PDF**

The PBC transactions use account `51000 Wood Product Brokerage COGS` with sub-accounts for Materials, Freight, Secondary Processing. The Financials PDF calls this revenue stream "Wood Platform Sales." The PBC transactions also show `41000 Wood Product Income:41100 Wood Product Brokerage`. These naming mismatches (Brokerage vs Platform) suggest the COA predates the current business model framing. Minor but worth noting for cleanup.

### Warehouse Locations

**Source: Entity PDF, page 13**

| Entity | Function | Address | Notes |
|--------|----------|---------|-------|
| Cambium East | Processing + Distribution | 9325 Snowden River Pkwy, Columbia, MD 21046 | Primary mill/warehouse |
| Cambium East | Processing + Distribution | 1589 Sulphur Spring Rd STE 111, Halethorpe, MD 21227 | **Vacating by Sep 2026** |
| Cambium Midwest | Distribution Only | 4205 W. Superior St, Duluth, MN 55807 | Primary distribution |
| Cambium Midwest | Overflow Storage | 5785 Berquist Rd, Duluth, MN 55804 | Overflow only |

---

## 5. WHAT'S NOT IN THE DOCUMENTS (gaps to fill)

The following items from the previous version of this analysis were **not sourced from any provided document**. They are either reasonable inferences or outright guesses:

| Claim | Status |
|-------|--------|
| "Venture-backed" | **[NOT IN DOCS]** — Inferred from burn rate + equity raises, but no investors or round details are named anywhere |
| "Series A/B stage" | **[NOT IN DOCS]** — Pure guess. No round type, investors, or cap table info provided |
| The ~$26M equity raise happened | **[INFERENCE]** — Math works out from balance sheet, but no fundraising details, press release, or investor names in docs |
| Convertible notes converted | **[INFERENCE]** — LT liabilities dropped $13M while equity jumped $19M. Plausible but unconfirmed |
| "likely no real internal controls" | **[INFERENCE]** — Based on QBO usage and transaction patterns. Not stated. |
| "6-12 month project minimum" for NetSuite | **[NOT IN DOCS]** — My estimate. No implementation timeline is given. |
| "Accounting infrastructure is immature" | **[INFERENCE]** — Based on QBO for subs, naming inconsistencies. Not directly stated. |
| All pricing/compensation figures ($160-200K, $175-250/hr, etc.) | **[NOT IN DOCS]** — General market estimates. No comp info was provided. |
| "No evidence of audit" | **[INFERENCE]** — Financials are labeled "Confidential" and management-prepared. No audit firm is mentioned, but absence of evidence isn't evidence of absence. |

---

## 6. CRITICAL QUESTIONS TO ASK

### Financial Health & Runway
1. **What was the total raise amount, round type, and valuation?** Balance sheet implies ~$26M equity infusion but nothing is stated.
2. **What is the current monthly burn rate and cash runway?** $8.06M cash with $6.78M annual loss = ~14 months at current burn, but this assumes no growth-related changes.
3. **Is there a path-to-profitability target?** The projections show revenue only, not expenses. What year is breakeven modeled?
4. **Who are the investors and what's the board composition?**
5. **Has there been an audit?** At $10M+ revenue with multi-entity structure, investor-backed — are they being audited? By whom?

### Accounting Quality & Discrepancies
6. **Why does the entity doc say BFLC has "no employees" and "no payroll" when Paylocity is running $75K/month payroll through BFLC's bank account?** Are these PBC employees working at the Baltimore location with payroll routed through BFLC's account? Or does BFLC have its own W-2 employees?
7. **The entity doc says payroll is via Rippling, but transactions show Paylocity. Which is it?** Is Rippling the HRIS while Paylocity is the payroll processor? Or is this a transition?
8. **The margin figures in the Definitions section don't match the income statement.** Wood Platform: claimed 29.04%, calculated 25.2%. Joint Development: claimed 29.40%, calculated 16.6%. What's the discrepancy?
9. **What's in "Other Current Assets" ($3.53M) and "Other Assets" ($2.80M)?** These are large unexplained line items on the balance sheet.
10. **Has the ASC 606 transition for Platform Fees been implemented?** The Definitions section describes it as a planned change ("Moving from GMV to Net Revenue") not a completed one.
11. **What explains the $2.37M gap between invoiced ($12.4M) and revenue ($10.0M) in 2025?** Timing? Deferred revenue? Credits?
12. **How are intercompany transactions currently being eliminated?** PBC sent $263K to BFL-related accounts and $105K to Intectural in December alone.
13. **What's the current close process?** Monthly? Quarterly? How many days to close?
14. **The 2024 equity was negative $8.6M — was there going-concern risk before the 2025 raise?**

### The Controller Role
15. **What is the actual scope?** Oversee NetSuite migration AND run controller functions? Or is there a separate implementation team?
16. **What's the current finance headcount?** Bookkeeper? Staff accountant? AP clerk?
17. **Nicole K is listed as invoice manager for 3 BUs — what's her actual role?** AP/AR or operations?
18. **What's the reporting cadence and audience?** Board deck? Investor updates? BU-level P&Ls?
19. **Is there a CFO or VP Finance, or does this role report directly to the CEO?**
20. **What's the compensation range and equity component?**

### Operational / ERP
21. **Who is the NetSuite implementation partner?** The entity doc reads like a consultant onboarding package. Is there one already engaged?
22. **What's the go-live target for NetSuite?** Contract started Sep 2025 — what's been done so far?
23. **What about ClickUp?** Entity PDF (p.6) mentions "replacing current ClickUp workflows" with NetSuite Jobs. Is ClickUp the current project management system?
24. **How is inventory actually tracked today?** QBO doesn't handle lumber UOM (board feet, linear feet conversions) that the entity doc (p.6) requires.
25. **What's the state of the Sulphur Springs lease exit?** (vacating by Sep 2026 per Entity PDF p.13)

### Revenue & Risk
26. **What's customer concentration?** SmartLam ($373K in one month), Rock Creek Tree/National Links Trust ($373K), Parton Lumber ($313K) all appear as large individual relationships.
27. **Contractor classification risk at BFLC**: Workers billed as contractors at $15-20/hr for 32-80 hour periods with regular biweekly billing. This looks like employee misclassification. Has this been reviewed by employment counsel?
28. **Multi-state nexus**: Delaware (incorporation), California (SF office address per Entity PDF p.9), Maryland (BFLC operations), Minnesota (Intectural operations). What's the sales tax posture on physical goods?
29. **What's the "new 118K sq ft Baltimore facility" mentioned in Financials PDF p.3?** "Live in 2026" — is this under lease? What's the cost?

---

## 7. ROLE ASSESSMENT

### What Makes This Interesting
- 5x revenue growth in one year ($2M → $10M) — verified from financials
- Complex multi-entity, multi-BU structure with genuinely varied accounting needs
- NetSuite migration across 3 source systems is substantive work
- Entity doc mentions enterprise customers: Google, Meta, Amazon (Financials PDF p.4)

### What Makes This Scary
- **Cash burn**: ($6.78M) net loss on $10M revenue — verified
- **Projections don't include expenses**: Only revenue is projected. No expense forecast, no breakeven model — verified
- **Margin claims don't match math**: Multiple stated margins disagree with the income statement in the same PDF
- **Dual mandate**: NetSuite migration + controller duties simultaneously
- **Subsidiary accounting contradictions**: Entity doc says no employees/payroll at subs, but Paylocity is running payroll at BFLC
- **9 business units** ranging from simple SaaS to complex manufacturing with yield loss
- **13 bank accounts** across 6 institutions in active transition
- **No information on**: investors, round type, audit status, finance team, comp range, CFO existence

### Pricing Considerations

**[NOT IN DOCS — these are general market observations, not sourced from Cambium materials]**

The scope here is substantial: 3-entity consolidation, ERP migration, 9 BUs with manufacturing/inventory complexity, plus ongoing controller duties. Price for:
- The ERP migration as a discrete project (this is consulting work, not steady-state controller work)
- The ongoing controller function separately
- The risk that this is a single-person finance function at a company burning $500K+/month

---

## 8. VERIFICATION STEPS BEFORE ACCEPTING

1. Request **audited or reviewed financial statements** — the provided financials are management-prepared
2. Request **bank statements** for 3+ months to verify cash position
3. Request a **cap table summary** — the balance sheet implies a major equity event but nothing is disclosed
4. Request **AP aging and AR aging** — $5.6M current liabilities and $2.2M AR need detail
5. Request the **NetSuite implementation SOW and timeline** — the contract started Sep 2025 but the onboarding guide is from Mar 2026
6. Ask for a **30-minute call with whoever is currently doing the books** to understand actual state
7. Get clarity on the **BFLC employee/payroll situation** before proceeding — if there's a misclassification issue, that's a pre-existing liability
8. Ask to see a **recent board deck or investor update** to understand reporting expectations
