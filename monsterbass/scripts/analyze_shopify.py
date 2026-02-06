#!/usr/bin/env python3
"""
MonsterBass Phase 2: Shopify Data Analysis Pipeline

Combines Shopify data (from API extraction or CSV export) with QBO data
to produce the analyses that were blocked in Phase 1:

1. Revenue Reconciliation (Shopify ↔ QBO)
2. SKU-Level Margin Analysis (Shopify sales × Legacy costs)
3. Refund & Return Rate Analysis
4. Customer Metrics (cohorts, retention, concentration)
5. Product Performance Ranking

Usage:
    python3 scripts/analyze_shopify.py                    # Run all analyses
    python3 scripts/analyze_shopify.py reconciliation     # Single analysis
    python3 scripts/analyze_shopify.py --from-export      # Use CSV exports
    python3 scripts/analyze_shopify.py --list             # List analyses
"""

import sys
import os
import csv
import json
import argparse
import re
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import PROJECT_ROOT, OUTPUT_DIR

# ═══════════════════════════════════════════════
# PATH CONFIG
# ═══════════════════════════════════════════════

SHOPIFY_DIR = os.path.join(PROJECT_ROOT, "shopify_cleaned")
QBO_DIR = os.path.join(PROJECT_ROOT, "output", "derived_reports")
LEGACY_GL = os.path.join(PROJECT_ROOT, "cleaned", "monsterbass_legacy", "general_ledger.csv")
PRIMARY_GL = os.path.join(PROJECT_ROOT, "cleaned", "outdoor_playground", "general_ledger.csv")
ANALYSIS_DIR = os.path.join(PROJECT_ROOT, "output", "shopify_analysis")


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)
    return path


# ═══════════════════════════════════════════════
# DATA LOADERS
# ═══════════════════════════════════════════════

def load_csv(path):
    """Load CSV file into list of dicts."""
    if not os.path.exists(path):
        print(f"  WARNING: File not found: {path}")
        return []
    with open(path, "r") as f:
        return list(csv.DictReader(f))


def load_legacy_costs():
    """Extract SKU-level cost data from legacy general ledger.

    Legacy GL has product costs in the Memo/Description field as:
        'Product Name - Variant  [Type]  UPC XXXXXXXXXXXX'
    with Amount = cost per unit, for rows where Distribution account = 'Inventory Asset'
    and Transaction type = 'Bill'
    """
    if not os.path.exists(LEGACY_GL):
        print(f"  WARNING: Legacy GL not found: {LEGACY_GL}")
        return {}

    costs = {}  # UPC -> {name, cost, vendor, date, count}
    cost_by_name = {}  # product_name_lower -> same

    with open(LEGACY_GL, "r") as f:
        reader = csv.reader(f)
        header = next(reader)

        # Find column indices
        col_map = {h.strip(): i for i, h in enumerate(header)}
        dist_idx = col_map.get("Distribution account", 1)
        date_idx = col_map.get("Transaction date", 2)
        type_idx = col_map.get("Transaction type", 3)
        name_idx = col_map.get("Name", 5)
        memo_idx = col_map.get("Memo/Description", 6)
        amt_idx = col_map.get("Amount", 8)

        for row in reader:
            if len(row) <= max(dist_idx, type_idx, memo_idx, amt_idx):
                continue

            dist = row[dist_idx].strip()
            txn_type = row[type_idx].strip()
            memo = row[memo_idx].strip()
            amount_str = row[amt_idx].strip()

            if dist != "Inventory Asset" or txn_type != "Bill":
                continue
            if not memo or not amount_str:
                continue

            try:
                amount = abs(float(amount_str.replace(",", "")))
            except ValueError:
                continue

            vendor = row[name_idx].strip() if len(row) > name_idx else ""
            date = row[date_idx].strip() if len(row) > date_idx else ""

            # Extract UPC from memo
            upc_match = re.search(r'UPC\s+(\d{12,13})', memo)
            upc = upc_match.group(1) if upc_match else None

            # Extract product name (everything before UPC or product type marker)
            product_name = re.split(r'\s{2,}|UPC', memo)[0].strip()

            entry = {
                "product_name": product_name,
                "cost": amount,
                "vendor": vendor,
                "date": date,
                "upc": upc,
            }

            if upc:
                if upc not in costs:
                    costs[upc] = []
                costs[upc].append(entry)

            name_key = product_name.lower().strip()
            if name_key:
                if name_key not in cost_by_name:
                    cost_by_name[name_key] = []
                cost_by_name[name_key].append(entry)

    print(f"  Loaded {len(costs)} UPC-based cost entries, {len(cost_by_name)} name-based entries")
    return {"by_upc": costs, "by_name": cost_by_name}


def load_qbo_shopify_revenue():
    """Load QBO-derived Shopify revenue by month."""
    path = os.path.join(QBO_DIR, "monthly_revenue_by_channel.csv")
    rows = load_csv(path)
    result = {}
    for r in rows:
        month = r.get("Month", "")
        shopify = r.get("Shopify", "0")
        try:
            result[month] = float(shopify)
        except ValueError:
            result[month] = 0
    return result


def load_deposit_detail():
    """Load QBO deposit detail for Shopify deposit matching."""
    path = os.path.join(PROJECT_ROOT, "cleaned", "outdoor_playground", "deposit_detail.csv")
    if not os.path.exists(path):
        return []
    deposits = []
    with open(path, "r") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if len(row) < 9:
                continue
            memo = row[6] if len(row) > 6 else ""
            amount = row[8] if len(row) > 8 else ""
            date = row[1] if len(row) > 1 else ""
            if "shopify" in memo.lower() or "Shopify" in memo:
                try:
                    deposits.append({
                        "date": date.strip(),
                        "amount": float(amount.replace(",", "")),
                        "memo": memo.strip(),
                    })
                except ValueError:
                    continue
    return deposits


# ═══════════════════════════════════════════════
# ANALYSIS 1: REVENUE RECONCILIATION
# ═══════════════════════════════════════════════

def run_reconciliation():
    """Shopify ↔ QBO revenue reconciliation."""
    print("\n" + "=" * 60)
    print("ANALYSIS 1: REVENUE RECONCILIATION (Shopify ↔ QBO)")
    print("=" * 60)

    out_dir = ensure_dir(ANALYSIS_DIR)

    # Load Shopify monthly revenue
    shopify_monthly_path = os.path.join(SHOPIFY_DIR, "monthly_shopify_revenue.csv")
    shopify_data = {}
    shopify_rows = load_csv(shopify_monthly_path)
    for r in shopify_rows:
        shopify_data[r["Month"]] = {
            "gross": float(r["Gross_Revenue"]),
            "refunded": float(r["Refunded"]),
            "net": float(r["Net_Revenue"]),
            "shipping": float(r["Shipping"]),
            "tax": float(r["Tax"]),
            "discounts": float(r["Discounts"]),
            "orders": int(r["Order_Count"]),
        }

    # Load Shopify payouts
    shopify_payouts = {}
    payout_rows = load_csv(os.path.join(SHOPIFY_DIR, "monthly_payouts.csv"))
    for r in payout_rows:
        shopify_payouts[r["Month"]] = float(r["Net_Deposited"])

    # Load QBO revenue
    qbo_rev = load_qbo_shopify_revenue()

    # Load QBO Shopify deposits
    deposits = load_deposit_detail()
    qbo_deposits = defaultdict(float)
    for d in deposits:
        if d["date"]:
            # Parse date MM/DD/YYYY → YYYY-MM
            parts = d["date"].split("/")
            if len(parts) == 3:
                month = f"{parts[2]}-{parts[0].zfill(2)}"
                qbo_deposits[month] += d["amount"]

    # Build reconciliation
    all_months = sorted(set(
        list(shopify_data.keys()) +
        list(qbo_rev.keys()) +
        list(qbo_deposits.keys())
    ))

    recon_path = os.path.join(out_dir, "revenue_reconciliation.csv")
    summary_path = os.path.join(out_dir, "reconciliation_summary.md")

    total_shopify_gross = 0
    total_shopify_net = 0
    total_qbo = 0
    total_deposits = 0
    total_payout = 0
    variance_details = []

    with open(recon_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Month",
            "Shopify_Gross", "Shopify_Refunded", "Shopify_Net",
            "Shopify_Shipping", "Shopify_Tax", "Shopify_Discounts",
            "Shopify_Payout_Deposited",
            "QBO_Revenue", "QBO_Deposits",
            "Var_Net_vs_QBO_Rev", "Var_Payout_vs_QBO_Dep",
            "Order_Count",
        ])

        for month in all_months:
            s = shopify_data.get(month, {"gross": 0, "refunded": 0, "net": 0,
                                         "shipping": 0, "tax": 0, "discounts": 0, "orders": 0})
            p = shopify_payouts.get(month, 0)
            q = qbo_rev.get(month, 0)
            d = qbo_deposits.get(month, 0)

            var_rev = s["net"] - q
            var_dep = p - d

            total_shopify_gross += s["gross"]
            total_shopify_net += s["net"]
            total_qbo += q
            total_deposits += d
            total_payout += p

            if abs(var_rev) > 1000:
                variance_details.append((month, var_rev, "net vs QBO revenue"))
            if abs(var_dep) > 1000:
                variance_details.append((month, var_dep, "payout vs QBO deposits"))

            writer.writerow([
                month,
                round(s["gross"], 2), round(s["refunded"], 2), round(s["net"], 2),
                round(s["shipping"], 2), round(s["tax"], 2), round(s["discounts"], 2),
                round(p, 2),
                round(q, 2), round(d, 2),
                round(var_rev, 2), round(var_dep, 2),
                s["orders"],
            ])

    print(f"  Wrote {len(all_months)} months → {recon_path}")

    # Write summary report
    with open(summary_path, "w") as f:
        f.write("# Revenue Reconciliation: Shopify ↔ QBO\n\n")
        f.write(f"**Period:** {all_months[0] if all_months else 'N/A'} to {all_months[-1] if all_months else 'N/A'}\n\n")
        f.write("## Totals\n\n")
        f.write(f"| Metric | Amount |\n")
        f.write(f"|--------|--------|\n")
        f.write(f"| Shopify Gross Revenue | ${total_shopify_gross:,.2f} |\n")
        f.write(f"| Shopify Net Revenue | ${total_shopify_net:,.2f} |\n")
        f.write(f"| QBO Shopify Revenue | ${total_qbo:,.2f} |\n")
        f.write(f"| **Revenue Variance** | **${total_shopify_net - total_qbo:,.2f}** |\n")
        f.write(f"| Shopify Payouts | ${total_payout:,.2f} |\n")
        f.write(f"| QBO Shopify Deposits | ${total_deposits:,.2f} |\n")
        f.write(f"| **Deposit Variance** | **${total_payout - total_deposits:,.2f}** |\n\n")

        if variance_details:
            f.write("## Material Variances (>$1,000)\n\n")
            f.write("| Month | Variance | Type |\n")
            f.write("|-------|----------|------|\n")
            for month, var, vtype in variance_details:
                f.write(f"| {month} | ${var:,.2f} | {vtype} |\n")
            f.write("\n")

        f.write("## Expected Variance Sources\n\n")
        f.write("- **Timing differences**: Order date vs deposit date (1-3 business days)\n")
        f.write("- **Shopify fees**: Processing fees deducted before payout\n")
        f.write("- **Shopify Capital**: Daily auto-withdrawals from payouts (~$500-700/day)\n")
        f.write("- **Chargebacks/disputes**: Deducted from payouts, may not match QBO timing\n")
        f.write("- **Currency rounding**: Minor differences from rounding\n\n")

        f.write("## Reconciliation Status\n\n")
        total_var = abs(total_shopify_net - total_qbo)
        pct = (total_var / total_qbo * 100) if total_qbo else 0
        if pct < 2:
            f.write(f"Variance is {pct:.1f}% of QBO revenue — **within normal range**.\n")
        elif pct < 5:
            f.write(f"Variance is {pct:.1f}% of QBO revenue — **review recommended**.\n")
        else:
            f.write(f"Variance is {pct:.1f}% of QBO revenue — **investigation required**.\n")

    print(f"  Wrote summary → {summary_path}")


# ═══════════════════════════════════════════════
# ANALYSIS 2: SKU-LEVEL MARGIN ANALYSIS
# ═══════════════════════════════════════════════

def run_margin_analysis():
    """SKU margin analysis: Shopify revenue × Legacy costs."""
    print("\n" + "=" * 60)
    print("ANALYSIS 2: SKU-LEVEL MARGIN ANALYSIS")
    print("=" * 60)

    out_dir = ensure_dir(ANALYSIS_DIR)

    # Load Shopify SKU revenue
    sku_rev = load_csv(os.path.join(SHOPIFY_DIR, "sku_revenue_summary.csv"))
    if not sku_rev:
        print("  No SKU revenue data — skipping")
        return

    # Load legacy costs
    costs = load_legacy_costs()
    if not costs:
        print("  No legacy cost data — skipping")
        return

    by_upc = costs["by_upc"]
    by_name = costs["by_name"]

    # Match SKUs to costs
    margin_path = os.path.join(out_dir, "sku_margins.csv")
    unmatched_path = os.path.join(out_dir, "sku_unmatched.csv")
    summary_path = os.path.join(out_dir, "margin_summary.md")

    matched = []
    unmatched = []
    total_revenue = 0
    total_cost = 0
    matched_revenue = 0

    for sku_row in sku_rev:
        sku = sku_row.get("SKU", "")
        product_name = sku_row.get("Product_Name", "")
        barcode = sku_row.get("Barcode", "")
        revenue = float(sku_row.get("Total_Revenue", 0))
        quantity = int(sku_row.get("Total_Quantity", 0))
        total_revenue += revenue

        # Try to match by barcode (UPC) first
        cost_entries = None
        match_method = ""
        if barcode and barcode in by_upc:
            cost_entries = by_upc[barcode]
            match_method = "UPC"
        else:
            # Try name matching
            name_key = product_name.lower().strip()
            if name_key in by_name:
                cost_entries = by_name[name_key]
                match_method = "exact_name"
            else:
                # Fuzzy: try first part of product name
                for cost_key in by_name:
                    if name_key and (name_key in cost_key or cost_key in name_key):
                        cost_entries = by_name[cost_key]
                        match_method = "fuzzy_name"
                        break

        if cost_entries:
            # Use average cost from all matching entries
            avg_cost = sum(e["cost"] for e in cost_entries) / len(cost_entries)
            total_cost_for_sku = avg_cost * quantity
            margin = revenue - total_cost_for_sku
            margin_pct = (margin / revenue * 100) if revenue > 0 else 0
            total_cost += total_cost_for_sku
            matched_revenue += revenue

            matched.append({
                "sku": sku,
                "product_name": product_name,
                "barcode": barcode,
                "revenue": revenue,
                "quantity": quantity,
                "avg_unit_cost": round(avg_cost, 2),
                "total_cost": round(total_cost_for_sku, 2),
                "gross_margin": round(margin, 2),
                "margin_pct": round(margin_pct, 1),
                "match_method": match_method,
                "cost_vendor": cost_entries[0]["vendor"],
                "cost_entries": len(cost_entries),
            })
        else:
            unmatched.append({
                "sku": sku,
                "product_name": product_name,
                "barcode": barcode,
                "revenue": revenue,
                "quantity": quantity,
            })

    # Write matched margins
    with open(margin_path, "w", newline="") as f:
        fields = [
            "sku", "product_name", "barcode", "revenue", "quantity",
            "avg_unit_cost", "total_cost", "gross_margin", "margin_pct",
            "match_method", "cost_vendor", "cost_entries",
        ]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for m in sorted(matched, key=lambda x: x["revenue"], reverse=True):
            writer.writerow(m)
    print(f"  Wrote {len(matched)} matched SKUs → {margin_path}")

    # Write unmatched
    with open(unmatched_path, "w", newline="") as f:
        fields = ["sku", "product_name", "barcode", "revenue", "quantity"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for u in sorted(unmatched, key=lambda x: x["revenue"], reverse=True):
            writer.writerow(u)
    print(f"  Wrote {len(unmatched)} unmatched SKUs → {unmatched_path}")

    # Write summary
    overall_margin_pct = ((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0
    match_rate = (matched_revenue / total_revenue * 100) if total_revenue > 0 else 0

    with open(summary_path, "w") as f:
        f.write("# SKU-Level Margin Analysis\n\n")
        f.write("## Overview\n\n")
        f.write(f"| Metric | Value |\n")
        f.write(f"|--------|-------|\n")
        f.write(f"| Total Shopify Revenue | ${total_revenue:,.2f} |\n")
        f.write(f"| Matched to Cost Data | ${matched_revenue:,.2f} ({match_rate:.1f}%) |\n")
        f.write(f"| Unmatched Revenue | ${total_revenue - matched_revenue:,.2f} |\n")
        f.write(f"| Total COGS (matched) | ${total_cost:,.2f} |\n")
        f.write(f"| **Blended Gross Margin** | **{overall_margin_pct:.1f}%** |\n")
        f.write(f"| SKUs Matched | {len(matched)} |\n")
        f.write(f"| SKUs Unmatched | {len(unmatched)} |\n\n")

        # Top performers
        if matched:
            f.write("## Top 10 Products by Revenue\n\n")
            f.write("| Product | Revenue | COGS | Margin | Margin % |\n")
            f.write("|---------|---------|------|--------|----------|\n")
            for m in sorted(matched, key=lambda x: x["revenue"], reverse=True)[:10]:
                f.write(f"| {m['product_name'][:40]} | ${m['revenue']:,.2f} | ${m['total_cost']:,.2f} | ${m['gross_margin']:,.2f} | {m['margin_pct']}% |\n")
            f.write("\n")

            # Worst margins
            f.write("## Lowest Margin Products (potential losers)\n\n")
            f.write("| Product | Revenue | Margin % | Unit Cost |\n")
            f.write("|---------|---------|----------|----------|\n")
            for m in sorted(matched, key=lambda x: x["margin_pct"])[:10]:
                f.write(f"| {m['product_name'][:40]} | ${m['revenue']:,.2f} | {m['margin_pct']}% | ${m['avg_unit_cost']:,.2f} |\n")
            f.write("\n")

            # Best margins
            f.write("## Highest Margin Products\n\n")
            f.write("| Product | Revenue | Margin % | Unit Cost |\n")
            f.write("|---------|---------|----------|----------|\n")
            for m in sorted(matched, key=lambda x: x["margin_pct"], reverse=True)[:10]:
                f.write(f"| {m['product_name'][:40]} | ${m['revenue']:,.2f} | {m['margin_pct']}% | ${m['avg_unit_cost']:,.2f} |\n")
            f.write("\n")

        if unmatched:
            f.write("## Unmatched SKUs (top by revenue)\n\n")
            f.write("These products have Shopify revenue but no matching cost data in legacy books.\n\n")
            f.write("| Product | SKU | Revenue |\n")
            f.write("|---------|-----|--------|\n")
            for u in sorted(unmatched, key=lambda x: x["revenue"], reverse=True)[:15]:
                f.write(f"| {u['product_name'][:40]} | {u['sku']} | ${u['revenue']:,.2f} |\n")

    print(f"  Wrote summary → {summary_path}")


# ═══════════════════════════════════════════════
# ANALYSIS 3: REFUND & RETURN ANALYSIS
# ═══════════════════════════════════════════════

def run_refund_analysis():
    """Refund and return rate analysis."""
    print("\n" + "=" * 60)
    print("ANALYSIS 3: REFUND & RETURN ANALYSIS")
    print("=" * 60)

    out_dir = ensure_dir(ANALYSIS_DIR)

    # Load order summary for total order counts
    orders = load_csv(os.path.join(SHOPIFY_DIR, "orders_summary.csv"))
    refunds = load_csv(os.path.join(SHOPIFY_DIR, "refunds_detail.csv"))

    if not orders:
        print("  No order data — skipping")
        return

    # Monthly refund analysis
    monthly_orders = defaultdict(lambda: {"count": 0, "revenue": 0})
    monthly_refunds = defaultdict(lambda: {"count": 0, "amount": 0})
    refunded_orders = set()

    for o in orders:
        created = o.get("created_at", "")[:7]
        if created:
            monthly_orders[created]["count"] += 1
            try:
                monthly_orders[created]["revenue"] += float(o.get("total_price", 0))
            except ValueError:
                pass

        refund_amt = 0
        try:
            refund_amt = float(o.get("total_refunded", 0))
        except (ValueError, TypeError):
            pass
        if refund_amt > 0:
            refunded_orders.add(o.get("order_name", ""))
            monthly_refunds[created]["count"] += 1
            monthly_refunds[created]["amount"] += refund_amt

    # SKU-level refunds
    sku_refunds = defaultdict(lambda: {"count": 0, "amount": 0, "quantity": 0})
    if refunds:
        for r in refunds:
            sku = r.get("sku", "unknown")
            try:
                sku_refunds[sku]["amount"] += float(r.get("refund_subtotal", 0) or 0)
                sku_refunds[sku]["quantity"] += int(r.get("quantity_refunded", 0) or 0)
            except (ValueError, TypeError):
                pass
            sku_refunds[sku]["count"] += 1

    # Write monthly refund trends
    monthly_path = os.path.join(out_dir, "monthly_refunds.csv")
    all_months = sorted(set(list(monthly_orders.keys()) + list(monthly_refunds.keys())))

    with open(monthly_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Month", "Orders", "Revenue", "Refund_Count", "Refund_Amount", "Refund_Rate_Pct"])
        for month in all_months:
            o = monthly_orders.get(month, {"count": 0, "revenue": 0})
            r = monthly_refunds.get(month, {"count": 0, "amount": 0})
            rate = (r["count"] / o["count"] * 100) if o["count"] > 0 else 0
            writer.writerow([
                month, o["count"], round(o["revenue"], 2),
                r["count"], round(r["amount"], 2), round(rate, 1),
            ])
    print(f"  Wrote {len(all_months)} months → {monthly_path}")

    # Write summary
    total_orders = sum(m["count"] for m in monthly_orders.values())
    total_rev = sum(m["revenue"] for m in monthly_orders.values())
    total_refund_count = len(refunded_orders)
    total_refund_amt = sum(m["amount"] for m in monthly_refunds.values())
    overall_rate = (total_refund_count / total_orders * 100) if total_orders > 0 else 0
    refund_pct_of_rev = (total_refund_amt / total_rev * 100) if total_rev > 0 else 0

    summary_path = os.path.join(out_dir, "refund_summary.md")
    with open(summary_path, "w") as f:
        f.write("# Refund & Return Analysis\n\n")
        f.write("## Overview\n\n")
        f.write(f"| Metric | Value |\n")
        f.write(f"|--------|-------|\n")
        f.write(f"| Total Orders | {total_orders:,} |\n")
        f.write(f"| Orders with Refunds | {total_refund_count:,} |\n")
        f.write(f"| **Refund Rate** | **{overall_rate:.1f}%** |\n")
        f.write(f"| Total Revenue | ${total_rev:,.2f} |\n")
        f.write(f"| Total Refunded | ${total_refund_amt:,.2f} |\n")
        f.write(f"| **Refund % of Revenue** | **{refund_pct_of_rev:.1f}%** |\n")
        f.write(f"| Net Revenue | ${total_rev - total_refund_amt:,.2f} |\n\n")

        if sku_refunds:
            f.write("## Most Refunded Products\n\n")
            f.write("| SKU | Refund Count | Refund Amount | Units Returned |\n")
            f.write("|-----|-------------|---------------|---------------|\n")
            for sku in sorted(sku_refunds.keys(), key=lambda k: sku_refunds[k]["amount"], reverse=True)[:15]:
                s = sku_refunds[sku]
                f.write(f"| {sku} | {s['count']} | ${s['amount']:,.2f} | {s['quantity']} |\n")

    print(f"  Wrote summary → {summary_path}")


# ═══════════════════════════════════════════════
# ANALYSIS 4: CUSTOMER METRICS
# ═══════════════════════════════════════════════

def run_customer_analysis():
    """Customer cohort, retention, and concentration analysis."""
    print("\n" + "=" * 60)
    print("ANALYSIS 4: CUSTOMER METRICS")
    print("=" * 60)

    out_dir = ensure_dir(ANALYSIS_DIR)

    customers = load_csv(os.path.join(SHOPIFY_DIR, "customers.csv"))
    orders = load_csv(os.path.join(SHOPIFY_DIR, "orders_summary.csv"))

    if not customers and not orders:
        print("  No customer or order data — skipping")
        return

    # ── Customer concentration from orders ──
    customer_revenue = defaultdict(lambda: {"revenue": 0, "orders": 0, "first": "", "last": ""})
    for o in orders:
        email = o.get("customer_email", "anonymous")
        if not email:
            email = "anonymous"
        try:
            rev = float(o.get("total_price", 0))
        except ValueError:
            rev = 0
        customer_revenue[email]["revenue"] += rev
        customer_revenue[email]["orders"] += 1
        created = o.get("created_at", "")[:10]
        if not customer_revenue[email]["first"] or created < customer_revenue[email]["first"]:
            customer_revenue[email]["first"] = created
        if created > customer_revenue[email]["last"]:
            customer_revenue[email]["last"] = created

    # Sort by revenue
    sorted_customers = sorted(customer_revenue.items(), key=lambda x: x[1]["revenue"], reverse=True)

    # Write customer concentration
    conc_path = os.path.join(out_dir, "customer_concentration.csv")
    with open(conc_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Rank", "Customer_Email", "Revenue", "Orders", "First_Order", "Last_Order", "Cumulative_Pct"])
        total_rev = sum(c["revenue"] for _, c in sorted_customers)
        cumulative = 0
        for i, (email, data) in enumerate(sorted_customers, 1):
            cumulative += data["revenue"]
            pct = (cumulative / total_rev * 100) if total_rev > 0 else 0
            writer.writerow([
                i, email, round(data["revenue"], 2), data["orders"],
                data["first"], data["last"], round(pct, 1),
            ])
    print(f"  Wrote {len(sorted_customers)} customers → {conc_path}")

    # ── Cohort analysis ──
    cohorts = defaultdict(lambda: {"customers": 0, "revenue": 0, "orders": 0, "repeat": 0})
    for email, data in customer_revenue.items():
        if data["first"]:
            cohort_month = data["first"][:7]
            cohorts[cohort_month]["customers"] += 1
            cohorts[cohort_month]["revenue"] += data["revenue"]
            cohorts[cohort_month]["orders"] += data["orders"]
            if data["orders"] > 1:
                cohorts[cohort_month]["repeat"] += 1

    cohort_path = os.path.join(out_dir, "customer_cohorts.csv")
    with open(cohort_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Cohort_Month", "New_Customers", "Revenue", "Orders", "Repeat_Customers", "Repeat_Rate_Pct", "LTV"])
        for month in sorted(cohorts.keys()):
            c = cohorts[month]
            repeat_rate = (c["repeat"] / c["customers"] * 100) if c["customers"] > 0 else 0
            ltv = (c["revenue"] / c["customers"]) if c["customers"] > 0 else 0
            writer.writerow([
                month, c["customers"], round(c["revenue"], 2), c["orders"],
                c["repeat"], round(repeat_rate, 1), round(ltv, 2),
            ])
    print(f"  Wrote {len(cohorts)} cohorts → {cohort_path}")

    # ── Summary ──
    total_customers = len(sorted_customers)
    total_rev = sum(c["revenue"] for _, c in sorted_customers)
    repeat_customers = sum(1 for _, c in sorted_customers if c["orders"] > 1)
    one_time = total_customers - repeat_customers

    # Top 10% / 20% concentration
    top_10_rev = sum(c["revenue"] for _, c in sorted_customers[:max(1, total_customers // 10)])
    top_20_rev = sum(c["revenue"] for _, c in sorted_customers[:max(1, total_customers // 5)])
    top_10_pct = (top_10_rev / total_rev * 100) if total_rev > 0 else 0
    top_20_pct = (top_20_rev / total_rev * 100) if total_rev > 0 else 0

    summary_path = os.path.join(out_dir, "customer_summary.md")
    with open(summary_path, "w") as f:
        f.write("# Customer Analysis\n\n")
        f.write("## Overview\n\n")
        f.write(f"| Metric | Value |\n")
        f.write(f"|--------|-------|\n")
        f.write(f"| Total Unique Customers | {total_customers:,} |\n")
        f.write(f"| One-Time Buyers | {one_time:,} ({one_time/total_customers*100:.1f}%) |\n") if total_customers > 0 else None
        f.write(f"| Repeat Customers | {repeat_customers:,} ({repeat_customers/total_customers*100:.1f}%) |\n") if total_customers > 0 else None
        f.write(f"| Average Revenue per Customer | ${total_rev/total_customers:,.2f} |\n") if total_customers > 0 else None
        f.write(f"| **Top 10% Revenue Concentration** | **{top_10_pct:.1f}%** |\n")
        f.write(f"| **Top 20% Revenue Concentration** | **{top_20_pct:.1f}%** |\n\n")

        f.write("## Top 15 Customers by Revenue\n\n")
        f.write("| Email | Revenue | Orders | First Order | Last Order |\n")
        f.write("|-------|---------|--------|-------------|------------|\n")
        for email, data in sorted_customers[:15]:
            display = email[:35] + "..." if len(email) > 35 else email
            f.write(f"| {display} | ${data['revenue']:,.2f} | {data['orders']} | {data['first']} | {data['last']} |\n")

    print(f"  Wrote summary → {summary_path}")


# ═══════════════════════════════════════════════
# ANALYSIS 5: PRODUCT PERFORMANCE
# ═══════════════════════════════════════════════

def run_product_performance():
    """Product performance ranking combining revenue and catalog data."""
    print("\n" + "=" * 60)
    print("ANALYSIS 5: PRODUCT PERFORMANCE RANKING")
    print("=" * 60)

    out_dir = ensure_dir(ANALYSIS_DIR)

    sku_rev = load_csv(os.path.join(SHOPIFY_DIR, "sku_revenue_summary.csv"))
    products = load_csv(os.path.join(SHOPIFY_DIR, "products_catalog.csv"))

    if not sku_rev:
        print("  No SKU revenue data — skipping")
        return

    # Build product catalog lookup
    catalog = {}
    for p in products:
        sku = p.get("sku", "")
        if sku:
            catalog[sku] = {
                "title": p.get("title", ""),
                "type": p.get("product_type", ""),
                "vendor": p.get("vendor", ""),
                "price": p.get("price", ""),
                "status": p.get("status", ""),
                "inventory": p.get("inventory_qty", ""),
            }

    # Combine
    perf_path = os.path.join(out_dir, "product_performance.csv")
    with open(perf_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Rank", "SKU", "Product_Name", "Product_Type", "Vendor",
            "Revenue", "Quantity", "Avg_Price", "Order_Count",
            "Current_Price", "Current_Inventory", "Status",
        ])
        for i, row in enumerate(sku_rev, 1):
            sku = row.get("SKU", "")
            cat = catalog.get(sku, {})
            writer.writerow([
                i, sku,
                row.get("Product_Name", ""),
                row.get("Product_Type", "") or cat.get("type", ""),
                cat.get("vendor", ""),
                row.get("Total_Revenue", ""),
                row.get("Total_Quantity", ""),
                row.get("Avg_Price", ""),
                row.get("Order_Count", ""),
                cat.get("price", ""),
                cat.get("inventory", ""),
                cat.get("status", ""),
            ])
    print(f"  Wrote {len(sku_rev)} products → {perf_path}")

    # Revenue by product type
    type_rev = defaultdict(lambda: {"revenue": 0, "quantity": 0, "skus": 0})
    for row in sku_rev:
        sku = row.get("SKU", "")
        cat = catalog.get(sku, {})
        ptype = row.get("Product_Type", "") or cat.get("type", "") or "Unknown"
        try:
            type_rev[ptype]["revenue"] += float(row.get("Total_Revenue", 0))
            type_rev[ptype]["quantity"] += int(row.get("Total_Quantity", 0))
        except ValueError:
            pass
        type_rev[ptype]["skus"] += 1

    type_path = os.path.join(out_dir, "revenue_by_product_type.csv")
    with open(type_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Product_Type", "Revenue", "Quantity", "SKU_Count", "Pct_of_Revenue"])
        total = sum(t["revenue"] for t in type_rev.values())
        for ptype in sorted(type_rev.keys(), key=lambda k: type_rev[k]["revenue"], reverse=True):
            t = type_rev[ptype]
            pct = (t["revenue"] / total * 100) if total > 0 else 0
            writer.writerow([ptype, round(t["revenue"], 2), t["quantity"], t["skus"], round(pct, 1)])
    print(f"  Wrote {len(type_rev)} product types → {type_path}")


# ═══════════════════════════════════════════════
# MASTER REPORT
# ═══════════════════════════════════════════════

def generate_master_report():
    """Compile all analysis summaries into a single Phase 2 report."""
    print("\n" + "=" * 60)
    print("GENERATING PHASE 2 MASTER REPORT")
    print("=" * 60)

    report_path = os.path.join(PROJECT_ROOT, "output", "Phase2_Shopify_Analysis.md")

    summaries = [
        ("Revenue Reconciliation", os.path.join(ANALYSIS_DIR, "reconciliation_summary.md")),
        ("SKU-Level Margin Analysis", os.path.join(ANALYSIS_DIR, "margin_summary.md")),
        ("Refund & Return Analysis", os.path.join(ANALYSIS_DIR, "refund_summary.md")),
        ("Customer Analysis", os.path.join(ANALYSIS_DIR, "customer_summary.md")),
    ]

    with open(report_path, "w") as f:
        f.write("# MonsterBass Phase 2: Shopify Data Analysis\n\n")
        f.write(f"**Report Date:** {datetime.now().strftime('%B %d, %Y')}\n")
        f.write(f"**Data Source:** Shopify Admin API + QBO Financial Data\n")
        f.write(f"**Audit Period:** January 2024 - December 2025\n\n")
        f.write("---\n\n")

        for title, path in summaries:
            if os.path.exists(path):
                with open(path, "r") as sf:
                    content = sf.read()
                    # Strip the H1 header (we're embedding in sections)
                    lines = content.split("\n")
                    if lines and lines[0].startswith("# "):
                        lines = lines[1:]
                    f.write(f"## {title}\n\n")
                    f.write("\n".join(lines))
                    f.write("\n\n---\n\n")
            else:
                f.write(f"## {title}\n\n")
                f.write("*Data not yet available. Run extraction first.*\n\n---\n\n")

        f.write("## Data Files Generated\n\n")
        f.write("| File | Location |\n")
        f.write("|------|----------|\n")
        if os.path.exists(ANALYSIS_DIR):
            for fname in sorted(os.listdir(ANALYSIS_DIR)):
                f.write(f"| {fname} | `output/shopify_analysis/{fname}` |\n")

    print(f"  Wrote master report → {report_path}")


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════

ANALYSES = {
    "reconciliation": run_reconciliation,
    "margins": run_margin_analysis,
    "refunds": run_refund_analysis,
    "customers": run_customer_analysis,
    "products": run_product_performance,
}

AVAILABLE = list(ANALYSES.keys())


def main():
    parser = argparse.ArgumentParser(
        description="MonsterBass Phase 2: Shopify data analysis for financial audit"
    )
    parser.add_argument(
        "analyses", nargs="*", default=AVAILABLE,
        help=f"Which analyses to run. Options: {', '.join(AVAILABLE)}",
    )
    parser.add_argument("--list", action="store_true", help="List available analyses")
    parser.add_argument("--from-export", action="store_true",
                        help="Use Shopify CSV exports instead of API data (place in shopify_cleaned/)")
    args = parser.parse_args()

    if args.list:
        print("Available analyses:")
        for name in AVAILABLE:
            print(f"  - {name}")
        return

    print(f"\nMonsterBass Phase 2: Shopify Analysis")
    print(f"Analyses: {', '.join(args.analyses)}")
    print(f"Data source: {'CSV exports' if args.from_export else 'API extraction'}")

    # Verify data exists
    if not os.path.exists(SHOPIFY_DIR):
        print(f"\nERROR: {SHOPIFY_DIR} not found.")
        print(f"Run `python3 scripts/shopify_extract.py` first, or place CSV exports in shopify_cleaned/")
        sys.exit(1)

    for name in args.analyses:
        if name not in ANALYSES:
            print(f"ERROR: Unknown analysis '{name}'. Available: {', '.join(AVAILABLE)}")
            sys.exit(1)
        try:
            ANALYSES[name]()
        except Exception as e:
            print(f"  ERROR in {name}: {e}")
            import traceback
            traceback.print_exc()

    # Always generate the master report
    generate_master_report()

    print(f"\n{'='*60}")
    print("ANALYSIS COMPLETE")
    print(f"{'='*60}")
    print(f"Analysis files: {ANALYSIS_DIR}/")
    print(f"Master report:  output/Phase2_Shopify_Analysis.md")


if __name__ == "__main__":
    main()
