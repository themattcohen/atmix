# MonsterBass Financial Quality Audit

## Project Overview

**Objective**: Comprehensive financial quality audit for D2C company preparing for potential investor due diligence, strategic planning, and operational clarity.

**Audit Period**: January 2024 - December 2025 (24 months, normalized)

**Entity Structure**: OUTDOOR PLAYGROUND = Primary (2024+), MONSTERBASS = Legacy (not for reporting)

---

## Data Inventory

### Source Files Received

| Entity | Report | Date Range | Rows | Status |
|--------|--------|------------|------|--------|
| **OUTDOOR PLAYGROUND** | | | | |
| | P&L | Sep 2023 - Feb 2026 | 166 | ⚠️ Needs trimming to 24mo |
| | Balance Sheet | Sep 2023 - Feb 2026 | 65 | ⚠️ Needs trimming to 24mo |
| | General Ledger | Jan 2024 - Dec 2025 | 11,268 | ✅ Ready |
| | Trial Balance | As of Dec 31, 2025 | 140 | ✅ Ready |
| | A/P Aging | As of Dec 31, 2025 | 30 | ✅ Ready |
| | Deposit Detail | Jan 2024 - Dec 2025 | 6,615 | ✅ Ready |
| | Expenses by Vendor | Jan 2024 - Dec 2025 | 91 | ✅ Ready |
| | A/R Aging | - | - | ℹ️ N/A (D2C, no AR) |
| | Sales by Customer | - | - | ✅ BUILT from GL |
| **MONSTERBASS** | | | | |
| | P&L | Jan 2024 - Dec 2025 | 53 | ✅ Ready |
| | Balance Sheet | Jan 2024 - Dec 2025 | 77 | ✅ Ready |
| | General Ledger | Jan 2024 - Dec 2025 | 3,647 | ✅ Ready |
| | Trial Balance | As of Dec 31, 2025 | 84 | ✅ Ready |
| | A/P Aging | As of Dec 31, 2025 | 69 | ✅ Ready |
| | A/R Aging | As of Dec 31, 2025 | 11 | ✅ Ready |
| | Expenses by Vendor | Jan 2024 - Dec 2025 | 38 | ✅ Ready |
| | Deposit Detail | - | - | ℹ️ Not needed (legacy) |
| | Sales by Customer | - | - | ✅ BUILT from GL |

### Derived Reports (Built from GL)

| Report | Rows | Purpose |
|--------|------|---------|
| `monthly_revenue_by_channel.csv` | 24 | Revenue by Shopify/Stripe/PayPal/Amazon/Retail by month |
| `monthly_cash_flow.csv` | 24 | Cash in/out/net by month |
| `revenue_channel_summary.csv` | 5 | 24-month totals by channel with % mix |
| `vendor_concentration.csv` | 98 | All vendors ranked by spend |
| `working_capital_trends.csv` | 24 | Cash + Inventory - AP by month |
| `debt_activity.csv` | 85 | SBA, Shopify Capital, loan activity |
| `sales_by_customer.csv` | 29 | Revenue by customer (payment processor) |
| `cc_charges_by_vendor.csv` | 125 | Credit card spend by vendor/card |
| `check_detail.csv` | 369 | All check transactions (single-sided, cash outflows) |
| `expenses_by_category.csv` | 38 | Expenses by distribution account |

### Still Blocked

| Report | Impact |
|--------|--------|
| **Shopify Data** | Cannot perform SKU-level margin analysis or Shopify ⇄ QBO reconciliation |

---

## Data Cleaning Plan

### Phase 1: Normalize Date Ranges
- Trim OUTDOOR PLAYGROUND P&L to Jan 2024 - Dec 2025 (remove Sep-Dec 2023, Jan-Feb 2026)
- Trim OUTDOOR PLAYGROUND Balance Sheet to Jan 2024 - Dec 2025
- Standardize all files to consistent 24-month window

### Phase 2: Standardize File Names
```
cleaned/
├── outdoor_playground/
│   ├── pl_monthly.csv
│   ├── balance_sheet_monthly.csv
│   ├── general_ledger.csv
│   ├── trial_balance.csv
│   ├── ap_aging.csv
│   ├── deposit_detail.csv
│   └── expenses_by_vendor.csv
└── monsterbass/
    ├── pl_monthly.csv
    ├── balance_sheet_monthly.csv
    ├── general_ledger.csv
    ├── trial_balance.csv
    ├── ap_aging.csv
    ├── ar_aging.csv
    └── expenses_by_vendor.csv
```

### Phase 3: Data Validation
- Verify P&L ties to General Ledger totals
- Verify Balance Sheet balances (A = L + E)
- Cross-check Trial Balance to P&L and Balance Sheet

---

## Subagent Architecture

### QBO-Only Analysis (Phase 1 - Current)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────────┐      ┌─────────────┐          ┌─────────────┐
│   P&L       │      │  Balance    │          │  Cash Flow  │
│  Analysis   │      │   Sheet     │          │  & Runway   │
│   Agent     │      │   Agent     │          │   Agent     │
└─────────────┘      └─────────────┘          └─────────────┘
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────────┐      ┌─────────────┐          ┌─────────────┐
│   COGS &    │      │ Compliance  │          │  Strategic  │
│  Margins    │      │  Scanner    │          │  Analyst    │
│   Agent     │      │   Agent     │          │   Agent     │
└─────────────┘      └─────────────┘          └─────────────┘
```

### Full Analysis (Phase 2 - After Shopify)

Add Revenue Integrity Agent for Shopify ⇄ QBO reconciliation

---

## Analysis Scope by Agent

### 1. P&L Analysis Agent
- Revenue trend analysis (MoM, YoY)
- Expense categorization review
- Gross margin calculation and trends
- Operating expense ratio analysis
- Seasonality patterns

### 2. Balance Sheet Agent
- Account reconciliation status
- Stale balance identification
- Inventory valuation review
- Intercompany balance analysis (if applicable)
- Working capital assessment

### 3. COGS & Margins Agent
- Cost structure analysis
- Margin trends by period
- Expense allocation review
- Vendor concentration in COGS

### 4. Cash Flow & Runway Agent
- Operating cash flow reconstruction
- Burn rate calculation
- Runway estimation
- Working capital cycle analysis
- Seasonality impact on cash

### 5. Compliance Scanner Agent
- Accrual identification
- Deferred revenue check
- Prepaid expense review
- Sales tax liability assessment
- Intercompany transaction review

### 6. Strategic Analyst Agent
- KPI calculation and benchmarking
- Trend synthesis across all areas
- Opportunity identification
- Risk flagging
- Investor-ready narrative development

---

## Entity Structure (CONFIRMED)

### Book Usage - NO CONSOLIDATION

| Books | Purpose | Reconciled? | Use For Analysis |
|-------|---------|-------------|------------------|
| **OUTDOOR PLAYGROUND** | Primary financials (2024+) | ✅ Yes | ALL P&L, Balance Sheet, Cash Flow |
| **MONSTERBASS (legacy)** | PO creation only | ❌ No (after 2023) | SKU-level cost data only |

### Per Client:
- **OUTDOOR PLAYGROUND** = **PRIMARY/ACTIVE** books (2024+)
  - Company transitioned from LLC → INC in 2024
  - Changed from cash → accrual basis in 2024
  - This is the reconciled, authoritative source for all financial reporting

- **Outdoor Playground: MONSTERBASS** = **LEGACY** books (2019-2023)
  - Not reconciled after 2023
  - Used only for Purchase Orders
  - Contains 2024-2025 entries (1,318 bills with SKU-level detail)
  - **ACCRETIVE VALUE**: Product-level costs, UPCs, vendor-product mapping

### What Legacy Books Add (SKU-Level Data):
- 1,676 inventory items with SKU codes
- 1,318 bills with product names, UPCs, and unit costs
- Example: "Dirty Dancer - Bone UPC 675162131789" @ $190/unit
- 9 vendors only in legacy (Chinese suppliers: Jinhua Jiafu, Hoyo Fishing, etc.)

### Analysis Approach:
1. **OUTDOOR PLAYGROUND** = ALL financial analysis (P&L, BS, Cash Flow, ratios)
2. **MONSTERBASS** = SKU-level cost analysis only (when combined with Shopify sales data)
3. **NO consolidation** - these are separate for good reason

---

## Open Questions (Remaining)

1. ~~**Missing Reports**: Sales by Customer~~ → ✅ BUILT from GL
2. **Shopify Timeline**: When will Shopify access be available? (Needed for SKU-level margin analysis)
3. ~~**Legacy Book Activity**: What's in MONSTERBASS 2024-2025?~~ → ✅ RESOLVED: SKU-level inventory costs

---

## Legacy Books Activity (RESOLVED)

**Finding**: MONSTERBASS legacy books contain 3,402 transactions in 2024-2025

| Type | Count | Value |
|------|-------|-------|
| Inventory Starting Value | 1,676 | SKU setup entries |
| Bills | 1,318 | Product-level purchase costs |
| Expenses | 312 | Misc |
| Inventory Qty Adjust | 70 | Stock adjustments |

**Status**: ✅ EXPLAINED - These are PO/inventory entries with SKU-level detail that the primary books don't have. This is accretive data for product margin analysis, not a problem.

---

## Execution Log

| Date | Action | Status |
|------|--------|--------|
| 2025-01-31 | Initial file inventory | ✅ Complete |
| 2025-01-31 | Date range analysis | ✅ Complete |
| 2025-01-31 | Missing report identification | ✅ Complete |
| 2025-01-31 | Entity structure clarified | ✅ Complete |
| 2025-01-31 | Data cleaning and normalization | ✅ Complete |
| 2025-01-31 | Legacy activity flag identified | ✅ Complete |
| 2025-01-31 | Launch QBO-only subagents | ✅ Complete |
| 2025-01-31 | Synthesize audit report | ✅ Complete |
| TBD | Shopify data integration | 🔧 Scripts ready — run `python3 scripts/shopify_extract.py` after configuring `scripts/config.py` |

---

## Output Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Cleaned Source Data | `/cleaned/outdoor_playground/` (7 files) | ✅ |
| Cleaned Legacy Data | `/cleaned/monsterbass_legacy/` (7 files) | ✅ |
| **Derived Reports** | `/output/derived_reports/` (10 files) | ✅ |
| Full Audit Report | `/output/MonsterBass_Financial_Audit_Report.md` | ✅ |
| Executive Summary | `/output/Executive_Summary.md` | ✅ |
| Master Questions List | `/output/Master_Questions_List.md` | ✅ |
| This Guide | `/AUDIT_GUIDE.md` | ✅ |

### Not Created (Planned but Not Needed)
- `/output/agent_reports/` - Analysis was synthesized directly into main report
- `/output/Action_Items.md` - Covered in Master Questions List
