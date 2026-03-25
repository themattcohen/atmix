# MonsterBass Book Relationships

This document explains the two-book accounting structure and how they work together.

---

## Entity Structure

### OUTDOOR PLAYGROUND (Primary Books)
**Purpose**: ALL financial reporting

| Attribute | Value |
|-----------|-------|
| Entity Type | INC (Corporation) |
| Accounting Method | Accrual |
| Active Period | 2024 onwards |
| Status | Reconciled, production-ready |

**Contains**:
- 11,260 GL transactions
- Reconciled bank accounts
- Complete chart of accounts
- Current vendor relationships

**Use For**:
- Profit & Loss statements
- Balance Sheet
- Cash Flow statements
- Financial ratios
- Tax reporting
- All official financial analysis

---

### MONSTERBASS (Legacy Books)
**Purpose**: SKU-level cost data ONLY

| Attribute | Value |
|-----------|-------|
| Entity Type | Legacy |
| Active Period | 2019-2023 (historical) |
| Status | NOT reconciled after 2023 |

**Contains**:
- 1,318 bills with product-level detail
- Product names with UPCs
- Unit costs per variant
- Vendor-product relationships

**Use For**:
- SKU margin analysis
- Product cost research
- Vendor-product mapping
- Historical cost trends

**Do NOT Use For**:
- Financial statements
- Current period reporting
- Balance verification

---

## How Legacy Data Is ACCRETIVE (Not Duplicative)

The legacy books provide data that does **not exist** in the primary books:

### 1. Product-Level Detail
```
Example Bill Line Item:
"Dirty Dancer - Bone UPC 675162131789" - $190/unit
```

The primary books show aggregated inventory purchases. The legacy books show which specific SKUs were purchased and at what unit cost.

### 2. Vendor-Product Relationships
9 vendors appear **only** in legacy books (not in primary):

| Vendor | Type |
|--------|------|
| Jinhua Jiafu Fishing | Chinese supplier |
| Hoyo Fishing Tackle | Chinese supplier |
| Yiwu Laison Import | Chinese supplier |
| Zhejiang Zhongxin | Chinese supplier |
| Weihai Silver Thread | Chinese supplier |
| Dongyang Zebing | Chinese supplier |
| Wenzhou Changyou | Chinese supplier |
| YiWu Juxi Fishing | Chinese supplier |
| One additional supplier | Chinese supplier |

These represent direct manufacturing relationships that inform product cost structure.

### 3. Unit Economics Data
- Per-variant costs (not just category totals)
- Enables margin calculation when combined with Shopify sales prices
- Historical cost trends by product line

---

## Data Flow

```
+-------------------+     +-------------------+
|  OUTDOOR          |     |  MONSTERBASS      |
|  PLAYGROUND       |     |  (Legacy)         |
+-------------------+     +-------------------+
         |                         |
         v                         v
  Financial Reports         SKU Cost Data
  - P&L                     - Unit costs
  - Balance Sheet           - Product names
  - Cash Flow               - UPCs
  - Ratios                  - Vendor mapping
         |                         |
         |                         v
         |              +-------------------+
         |              |  Shopify Sales    |
         |              |  Data             |
         |              +-------------------+
         |                         |
         v                         v
+-------------------------------------------+
|          Combined Analysis                |
+-------------------------------------------+
| Financial Health: OUTDOOR PLAYGROUND only |
| SKU Margins: Legacy costs + Shopify sales |
+-------------------------------------------+
```

---

## Key Points

1. **NO consolidation needed** - These are not parallel books requiring merger
2. **NO duplicate risk** - Different data types, different purposes
3. **Complementary data** - Legacy enables analysis that primary books cannot provide alone

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Which books for financial statements? | OUTDOOR PLAYGROUND only |
| Which books for product margins? | Legacy costs + Shopify prices |
| Are they duplicates? | No - different data, different purposes |
| Do I need to reconcile legacy? | No - use for cost reference only |
| Can I combine GL totals? | No - would create duplicates |

---

## Summary

The two-book structure is intentional and beneficial:

- **OUTDOOR PLAYGROUND** = The official financial record (use for all reporting)
- **MONSTERBASS Legacy** = A cost database (use for SKU-level margin analysis)

Together, they enable both accurate financial reporting AND granular product profitability analysis.
