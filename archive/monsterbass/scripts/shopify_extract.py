#!/usr/bin/env python3
"""
MonsterBass Shopify Data Extraction Script

Pulls all audit-relevant data from Shopify via GraphQL Bulk Operations API.
Outputs JSONL files to shopify_raw/, then converts to CSV in shopify_cleaned/.

Usage:
    python3 scripts/shopify_extract.py              # Run all extractions
    python3 scripts/shopify_extract.py orders        # Run single extraction
    python3 scripts/shopify_extract.py --list        # List available extractions
    python3 scripts/shopify_extract.py --test        # Test API connection only
"""

import sys
import os
import json
import time
import csv
import argparse
from datetime import datetime
from collections import defaultdict

import requests

# Add parent dir so config import works when run from project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import (
    SHOP_NAME, ACCESS_TOKEN, CLIENT_ID, CLIENT_SECRET, API_VERSION,
    AUDIT_START, AUDIT_END,
    POLL_INTERVAL_SECONDS, POLL_TIMEOUT_SECONDS,
    RAW_DIR, OUTPUT_DIR, ENV_PATH,
)


# ═══════════════════════════════════════════════
# TOKEN EXCHANGE
# ═══════════════════════════════════════════════

def obtain_access_token(shop_name: str, client_id: str, client_secret: str) -> str:
    """Exchange client credentials for an Admin API access token.

    Uses the client_credentials grant flow for custom apps created
    in the Shopify Dev Dashboard.
    """
    url = f"https://{shop_name}.myshopify.com/admin/oauth/access_token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
    }
    print(f"Requesting access token from {url} ...")
    resp = requests.post(url, json=payload, timeout=30)

    if resp.status_code != 200:
        print(f"Token exchange failed ({resp.status_code}): {resp.text}")
        # Fallback: try the older /access_token endpoint format
        print("Trying legacy token endpoint...")
        legacy_url = f"https://{shop_name}.myshopify.com/admin/oauth/access_token"
        legacy_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
        }
        resp = requests.post(legacy_url, json=legacy_payload, timeout=30)
        if resp.status_code != 200:
            print(f"Legacy token exchange also failed ({resp.status_code}): {resp.text}")
            sys.exit(1)

    data = resp.json()
    token = data.get("access_token")
    if not token:
        print(f"No access_token in response: {data}")
        sys.exit(1)

    print(f"Access token obtained (starts with {token[:12]}...)")
    return token


def save_token_to_env(token: str):
    """Append or update SHOPIFY_ACCESS_TOKEN in .env file."""
    lines = []
    found = False
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r") as f:
            for line in f:
                if line.strip().startswith("SHOPIFY_ACCESS_TOKEN="):
                    lines.append(f"SHOPIFY_ACCESS_TOKEN={token}\n")
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.append(f"SHOPIFY_ACCESS_TOKEN={token}\n")
    with open(ENV_PATH, "w") as f:
        f.writelines(lines)
    print(f"Token saved to {ENV_PATH}")


def resolve_access_token() -> str:
    """Get a working access token — from .env or via client credentials exchange."""
    if ACCESS_TOKEN:
        return ACCESS_TOKEN

    if not CLIENT_ID or not CLIENT_SECRET:
        print("ERROR: No SHOPIFY_ACCESS_TOKEN and no CLIENT_ID/CLIENT_SECRET in .env")
        print("       Run the setup steps in scripts/README.md")
        sys.exit(1)

    if not SHOP_NAME:
        print("ERROR: SHOPIFY_STORE must be set in .env")
        sys.exit(1)

    token = obtain_access_token(SHOP_NAME, CLIENT_ID, CLIENT_SECRET)
    save_token_to_env(token)
    return token


# ═══════════════════════════════════════════════
# API CLIENT
# ═══════════════════════════════════════════════

class ShopifyClient:
    """Thin wrapper around Shopify GraphQL Admin API."""

    def __init__(self, shop_name: str, access_token: str, api_version: str):
        if not shop_name or not access_token:
            print("ERROR: SHOP_NAME and ACCESS_TOKEN must be configured")
            sys.exit(1)
        self.endpoint = f"https://{shop_name}.myshopify.com/admin/api/{api_version}/graphql.json"
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }

    def execute(self, query: str) -> dict:
        """Execute a GraphQL query and return the JSON response."""
        resp = requests.post(
            self.endpoint,
            json={"query": query},
            headers=self.headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {json.dumps(data['errors'], indent=2)}")
        return data

    def test_connection(self) -> dict:
        """Verify API credentials work and return shop info."""
        query = """
        {
            shop {
                name
                myshopifyDomain
                plan { displayName }
                currencyCode
            }
        }
        """
        return self.execute(query)


# ═══════════════════════════════════════════════
# BULK OPERATION RUNNER
# ═══════════════════════════════════════════════

class BulkOperationRunner:
    """Manages Shopify bulk operations: submit, poll, download."""

    def __init__(self, client: ShopifyClient):
        self.client = client

    def submit(self, query: str) -> str:
        """Submit a bulk operation query. Returns the operation GID."""
        mutation = f'''
        mutation {{
            bulkOperationRunQuery(query: """{query}""") {{
                bulkOperation {{
                    id
                    status
                }}
                userErrors {{
                    field
                    message
                }}
            }}
        }}
        '''
        result = self.client.execute(mutation)
        op_data = result["data"]["bulkOperationRunQuery"]

        if op_data["userErrors"]:
            errors = op_data["userErrors"]
            raise RuntimeError(f"Bulk operation errors: {json.dumps(errors, indent=2)}")

        op_id = op_data["bulkOperation"]["id"]
        status = op_data["bulkOperation"]["status"]
        print(f"  Submitted bulk operation: {op_id} (status: {status})")
        return op_id

    def poll(self, operation_id: str) -> str:
        """Poll until the bulk operation completes. Returns the download URL."""
        poll_query = f'''
        {{
            node(id: "{operation_id}") {{
                ... on BulkOperation {{
                    id
                    status
                    errorCode
                    objectCount
                    fileSize
                    url
                    partialDataUrl
                }}
            }}
        }}
        '''
        start = time.time()
        last_count = 0

        while True:
            elapsed = time.time() - start
            if elapsed > POLL_TIMEOUT_SECONDS:
                raise TimeoutError(
                    f"Bulk operation {operation_id} did not complete within "
                    f"{POLL_TIMEOUT_SECONDS}s"
                )

            result = self.client.execute(poll_query)
            node = result["data"]["node"]
            status = node["status"]
            obj_count = node.get("objectCount", 0)

            if obj_count != last_count:
                print(f"  Status: {status} | Objects: {obj_count} | {elapsed:.0f}s elapsed")
                last_count = obj_count

            if status == "COMPLETED":
                url = node.get("url")
                file_size = node.get("fileSize", 0)
                print(f"  Completed: {obj_count} objects, {file_size} bytes")
                return url

            if status in ("FAILED", "CANCELED"):
                error_code = node.get("errorCode", "UNKNOWN")
                partial = node.get("partialDataUrl")
                msg = f"Bulk operation {status}: {error_code}"
                if partial:
                    msg += f"\n  Partial data available at: {partial}"
                raise RuntimeError(msg)

            time.sleep(POLL_INTERVAL_SECONDS)

    def download(self, url: str, dest_path: str) -> int:
        """Download the JSONL result file. Returns line count."""
        if url is None:
            print("  No data returned (empty result set)")
            return 0

        resp = requests.get(url, timeout=120, stream=True)
        resp.raise_for_status()

        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        lines = 0
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                lines += chunk.count(b"\n")

        print(f"  Downloaded to {dest_path} ({lines} lines)")
        return lines

    def run(self, name: str, query: str) -> str:
        """Full pipeline: submit → poll → download. Returns the file path."""
        print(f"\n{'='*60}")
        print(f"EXTRACTING: {name}")
        print(f"{'='*60}")

        dest = os.path.join(RAW_DIR, f"{name}.jsonl")
        op_id = self.submit(query)
        url = self.poll(op_id)
        self.download(url, dest)
        return dest


# ═══════════════════════════════════════════════
# QUERY DEFINITIONS
# ═══════════════════════════════════════════════

def get_queries() -> dict:
    """Return all bulk operation queries keyed by name.

    Notes on Shopify bulk operation query structure:
    - Root must be a connection (orders, products, customers) with edges/node
    - Nested connections (lineItems, variants) also use edges/node
    - Plain list fields (refunds, transactions on Order) are direct — no edges/node
    - Connections within plain lists (refundLineItems in Refund) also use edges/node
    """
    return {
        "orders": f"""
        {{
            orders(query: "created_at:>={AUDIT_START} created_at:<={AUDIT_END}") {{
                edges {{
                    node {{
                        id
                        name
                        createdAt
                        processedAt
                        closedAt
                        cancelledAt
                        displayFinancialStatus
                        displayFulfillmentStatus
                        totalPriceSet {{ shopMoney {{ amount currencyCode }} }}
                        currentTotalPriceSet {{ shopMoney {{ amount currencyCode }} }}
                        subtotalPriceSet {{ shopMoney {{ amount currencyCode }} }}
                        totalShippingPriceSet {{ shopMoney {{ amount currencyCode }} }}
                        totalTaxSet {{ shopMoney {{ amount currencyCode }} }}
                        totalDiscountsSet {{ shopMoney {{ amount currencyCode }} }}
                        totalRefundedSet {{ shopMoney {{ amount currencyCode }} }}
                        netPaymentSet {{ shopMoney {{ amount currencyCode }} }}
                        paymentGatewayNames
                        tags
                        note
                        customer {{
                            id
                            email
                            firstName
                            lastName
                        }}
                        lineItems {{
                            edges {{
                                node {{
                                    id
                                    name
                                    sku
                                    quantity
                                    originalTotalSet {{ shopMoney {{ amount currencyCode }} }}
                                    discountedTotalSet {{ shopMoney {{ amount currencyCode }} }}
                                    variant {{
                                        id
                                        sku
                                        price
                                        barcode
                                        product {{
                                            id
                                            productType
                                        }}
                                    }}
                                }}
                            }}
                        }}
                        refunds {{
                            id
                            createdAt
                            note
                            totalRefundedSet {{ shopMoney {{ amount currencyCode }} }}
                        }}
                        transactions {{
                            id
                            kind
                            status
                            processedAt
                            amountSet {{ shopMoney {{ amount currencyCode }} }}
                            gateway
                        }}
                    }}
                }}
            }}
        }}
        """,

        "products": """
        {
            products {
                edges {
                    node {
                        id
                        title
                        handle
                        productType
                        vendor
                        status
                        createdAt
                        updatedAt
                        tags
                        variants {
                            edges {
                                node {
                                    id
                                    title
                                    sku
                                    price
                                    compareAtPrice
                                    barcode
                                    inventoryQuantity
                                }
                            }
                        }
                    }
                }
            }
        }
        """,

        "customers": f"""
        {{
            customers(query: "created_at:<={AUDIT_END}") {{
                edges {{
                    node {{
                        id
                        email
                        firstName
                        lastName
                        createdAt
                        updatedAt
                        numberOfOrders
                        amountSpent {{ amount currencyCode }}
                        state
                        tags
                        defaultAddress {{
                            city
                            provinceCode
                            country
                        }}
                    }}
                }}
            }}
        }}
        """,

        "payouts": f"""
        {{
            shopifyPaymentsAccount {{
                payouts(query: "issued_at:>={AUDIT_START} issued_at:<={AUDIT_END}") {{
                    edges {{
                        node {{
                            id
                            issuedAt
                            net {{ amount currencyCode }}
                            status
                            transactionType
                            summary {{
                                chargesGross {{ amount currencyCode }}
                                chargesFee {{ amount currencyCode }}
                                refundsFeeGross {{ amount currencyCode }}
                                adjustmentsGross {{ amount currencyCode }}
                            }}
                        }}
                    }}
                }}
            }}
        }}
        """,
    }


# ═══════════════════════════════════════════════
# JSONL → CSV CONVERTERS
# ═══════════════════════════════════════════════

def safe_money(obj, *path):
    """Safely extract a money amount from nested dict. Returns float or None."""
    current = obj
    for key in path:
        if current is None or not isinstance(current, dict):
            return None
        current = current.get(key)
    if current is None:
        return None
    try:
        return float(current)
    except (ValueError, TypeError):
        return None


def safe_get(obj, *path, default=""):
    """Safely navigate nested dicts."""
    current = obj
    for key in path:
        if current is None or not isinstance(current, dict):
            return default
        current = current.get(key, default)
    return current if current is not None else default


def parse_jsonl(filepath: str) -> list:
    """Parse a Shopify bulk operation JSONL file.

    Shopify JSONL has parent-child relationships via __parentId.
    This reconstructs the tree so children are nested under parents.
    """
    if not os.path.exists(filepath):
        return []

    objects = {}  # id -> obj
    children = defaultdict(list)  # parentId -> [child, ...]
    roots = []

    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            obj_id = obj.get("id")
            parent_id = obj.get("__parentId")

            if obj_id:
                objects[obj_id] = obj

            if parent_id:
                children[parent_id].append(obj)
            else:
                roots.append(obj)

    # Register embedded objects (from plain list fields like refunds, transactions)
    # so that their children (e.g., refundLineItems) can be linked via __parentId
    for root in roots:
        for key, value in root.items():
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and "id" in item:
                        objects[item["id"]] = item

    # Attach children to parents
    for parent_id, kids in children.items():
        if parent_id in objects:
            parent = objects[parent_id]
            if "__children" not in parent:
                parent["__children"] = []
            parent["__children"].extend(kids)

    return roots


def convert_orders(jsonl_path: str, output_dir: str):
    """Convert orders JSONL to multiple CSV files for the audit."""
    records = parse_jsonl(jsonl_path)
    if not records:
        print("  No order records to convert")
        return

    os.makedirs(output_dir, exist_ok=True)

    # ── 1. orders_summary.csv ──
    # One row per order with financial totals
    summary_path = os.path.join(output_dir, "orders_summary.csv")
    summary_fields = [
        "order_name", "created_at", "processed_at", "financial_status",
        "fulfillment_status", "total_price", "subtotal", "shipping",
        "tax", "discounts", "total_refunded", "net_payment",
        "payment_gateway", "customer_email", "customer_name",
        "currency", "tags", "cancelled_at",
    ]
    with open(summary_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=summary_fields)
        writer.writeheader()
        for o in records:
            writer.writerow({
                "order_name": o.get("name", ""),
                "created_at": o.get("createdAt", ""),
                "processed_at": o.get("processedAt", ""),
                "financial_status": o.get("displayFinancialStatus", ""),
                "fulfillment_status": o.get("displayFulfillmentStatus", ""),
                "total_price": safe_money(o, "totalPriceSet", "shopMoney", "amount"),
                "subtotal": safe_money(o, "subtotalPriceSet", "shopMoney", "amount"),
                "shipping": safe_money(o, "totalShippingPriceSet", "shopMoney", "amount"),
                "tax": safe_money(o, "totalTaxSet", "shopMoney", "amount"),
                "discounts": safe_money(o, "totalDiscountsSet", "shopMoney", "amount"),
                "total_refunded": safe_money(o, "totalRefundedSet", "shopMoney", "amount"),
                "net_payment": safe_money(o, "netPaymentSet", "shopMoney", "amount"),
                "payment_gateway": ", ".join(o.get("paymentGatewayNames") or []),
                "customer_email": safe_get(o, "customer", "email"),
                "customer_name": f"{safe_get(o, 'customer', 'firstName')} {safe_get(o, 'customer', 'lastName')}".strip(),
                "currency": safe_get(o, "totalPriceSet", "shopMoney", "currencyCode"),
                "tags": ", ".join(o.get("tags") or []) if isinstance(o.get("tags"), list) else o.get("tags", ""),
                "cancelled_at": o.get("cancelledAt", ""),
            })
    print(f"  Wrote {len(records)} orders → {summary_path}")

    # ── 2. order_line_items.csv ──
    # One row per SKU per order for margin analysis
    lines_path = os.path.join(output_dir, "order_line_items.csv")
    line_fields = [
        "order_name", "created_at", "line_item_name", "sku", "barcode",
        "product_type", "quantity", "original_total", "discounted_total",
        "variant_price", "currency",
    ]
    line_count = 0
    with open(lines_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=line_fields)
        writer.writeheader()
        for o in records:
            order_name = o.get("name", "")
            created = o.get("createdAt", "")
            for li in o.get("__children", []):
                typename = li.get("__typename", "")
                # Line items are direct children of orders
                if "LineItem" in typename or li.get("sku") is not None or li.get("quantity") is not None:
                    writer.writerow({
                        "order_name": order_name,
                        "created_at": created,
                        "line_item_name": li.get("name", ""),
                        "sku": li.get("sku", safe_get(li, "variant", "sku")),
                        "barcode": safe_get(li, "variant", "barcode"),
                        "product_type": safe_get(li, "variant", "product", "productType"),
                        "quantity": li.get("quantity", ""),
                        "original_total": safe_money(li, "originalTotalSet", "shopMoney", "amount"),
                        "discounted_total": safe_money(li, "discountedTotalSet", "shopMoney", "amount"),
                        "variant_price": safe_get(li, "variant", "price"),
                        "currency": safe_get(li, "originalTotalSet", "shopMoney", "currencyCode"),
                    })
                    line_count += 1
    print(f"  Wrote {line_count} line items → {lines_path}")

    # ── 3. refunds_detail.csv ──
    refunds_path = os.path.join(output_dir, "refunds_detail.csv")
    refund_fields = [
        "order_name", "refund_created_at", "refund_total", "sku",
        "line_item_name", "quantity_refunded", "refund_subtotal",
        "refund_note", "currency",
    ]
    refund_count = 0
    with open(refunds_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=refund_fields)
        writer.writeheader()
        for o in records:
            order_name = o.get("name", "")
            # Refunds are embedded as a plain list in the order JSON
            refunds_list = o.get("refunds", [])
            # Also check __children for backward compatibility
            for child in o.get("__children", []):
                typename = child.get("__typename", "")
                if "Refund" in typename and "RefundLineItem" not in typename:
                    refunds_list.append(child)
            for refund in refunds_list:
                refund_total = safe_money(refund, "totalRefundedSet", "shopMoney", "amount")
                refund_note = refund.get("note", "")
                refund_date = refund.get("createdAt", "")
                currency = safe_get(refund, "totalRefundedSet", "shopMoney", "currencyCode")
                # Note: refundLineItems (connection) can't be nested inside
                # the refunds plain list in bulk operations, so we only have
                # aggregate refund totals per refund event.
                writer.writerow({
                    "order_name": order_name,
                    "refund_created_at": refund_date,
                    "refund_total": refund_total,
                    "sku": "",
                    "line_item_name": "",
                    "quantity_refunded": "",
                    "refund_subtotal": "",
                    "refund_note": refund_note,
                    "currency": currency,
                })
                refund_count += 1
    print(f"  Wrote {refund_count} refund records → {refunds_path}")

    # ── 4. monthly_shopify_revenue.csv ──
    # Aggregated by month for cross-reference with existing derived reports
    monthly = defaultdict(lambda: {
        "gross": 0.0, "refunded": 0.0, "net": 0.0,
        "shipping": 0.0, "tax": 0.0, "discounts": 0.0, "count": 0,
    })
    for o in records:
        created = o.get("createdAt", "")
        if not created:
            continue
        month = created[:7]  # "2024-01"
        m = monthly[month]
        m["gross"] += safe_money(o, "totalPriceSet", "shopMoney", "amount") or 0
        m["refunded"] += safe_money(o, "totalRefundedSet", "shopMoney", "amount") or 0
        m["net"] += safe_money(o, "netPaymentSet", "shopMoney", "amount") or 0
        m["shipping"] += safe_money(o, "totalShippingPriceSet", "shopMoney", "amount") or 0
        m["tax"] += safe_money(o, "totalTaxSet", "shopMoney", "amount") or 0
        m["discounts"] += safe_money(o, "totalDiscountsSet", "shopMoney", "amount") or 0
        m["count"] += 1

    monthly_path = os.path.join(output_dir, "monthly_shopify_revenue.csv")
    with open(monthly_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Month", "Gross_Revenue", "Refunded", "Net_Revenue",
            "Shipping", "Tax", "Discounts", "Order_Count",
        ])
        for month in sorted(monthly.keys()):
            m = monthly[month]
            writer.writerow([
                month,
                round(m["gross"], 2),
                round(m["refunded"], 2),
                round(m["net"], 2),
                round(m["shipping"], 2),
                round(m["tax"], 2),
                round(m["discounts"], 2),
                m["count"],
            ])
    print(f"  Wrote {len(monthly)} months → {monthly_path}")

    # ── 5. sku_revenue_summary.csv ──
    # Revenue by SKU for margin analysis against legacy cost data
    sku_data = defaultdict(lambda: {
        "name": "", "product_type": "", "barcode": "",
        "revenue": 0.0, "quantity": 0, "orders": set(),
    })
    for o in records:
        order_name = o.get("name", "")
        for child in o.get("__children", []):
            sku = child.get("sku") or safe_get(child, "variant", "sku")
            if not sku:
                continue
            s = sku_data[sku]
            s["name"] = child.get("name", "") or s["name"]
            s["product_type"] = safe_get(child, "variant", "product", "productType") or s["product_type"]
            s["barcode"] = safe_get(child, "variant", "barcode") or s["barcode"]
            s["revenue"] += safe_money(child, "originalTotalSet", "shopMoney", "amount") or 0
            s["quantity"] += child.get("quantity", 0) or 0
            s["orders"].add(order_name)

    sku_path = os.path.join(output_dir, "sku_revenue_summary.csv")
    with open(sku_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "SKU", "Product_Name", "Product_Type", "Barcode",
            "Total_Revenue", "Total_Quantity", "Order_Count", "Avg_Price",
        ])
        for sku in sorted(sku_data.keys(), key=lambda k: sku_data[k]["revenue"], reverse=True):
            s = sku_data[sku]
            avg = round(s["revenue"] / s["quantity"], 2) if s["quantity"] > 0 else 0
            writer.writerow([
                sku, s["name"], s["product_type"], s["barcode"],
                round(s["revenue"], 2), s["quantity"], len(s["orders"]), avg,
            ])
    print(f"  Wrote {len(sku_data)} SKUs → {sku_path}")


def convert_products(jsonl_path: str, output_dir: str):
    """Convert products JSONL to CSV."""
    records = parse_jsonl(jsonl_path)
    if not records:
        print("  No product records to convert")
        return

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "products_catalog.csv")
    fields = [
        "product_id", "title", "handle", "product_type", "vendor",
        "status", "created_at", "variant_id", "variant_title", "sku",
        "price", "compare_at_price", "barcode", "inventory_qty",
    ]

    row_count = 0
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for p in records:
            product_id = p.get("id", "")
            title = p.get("title", "")
            handle = p.get("handle", "")
            product_type = p.get("productType", "")
            vendor = p.get("vendor", "")
            status = p.get("status", "")
            created = p.get("createdAt", "")

            # Variants are children in bulk JSONL
            variants = p.get("__children", [])
            if variants:
                for v in variants:
                    writer.writerow({
                        "product_id": product_id,
                        "title": title,
                        "handle": handle,
                        "product_type": product_type,
                        "vendor": vendor,
                        "status": status,
                        "created_at": created,
                        "variant_id": v.get("id", ""),
                        "variant_title": v.get("title", ""),
                        "sku": v.get("sku", ""),
                        "price": v.get("price", ""),
                        "compare_at_price": v.get("compareAtPrice", ""),
                        "barcode": v.get("barcode", ""),
                        "inventory_qty": v.get("inventoryQuantity", ""),
                    })
                    row_count += 1
            else:
                writer.writerow({
                    "product_id": product_id,
                    "title": title,
                    "handle": handle,
                    "product_type": product_type,
                    "vendor": vendor,
                    "status": status,
                    "created_at": created,
                    "variant_id": "",
                    "variant_title": "",
                    "sku": "",
                    "price": "",
                    "compare_at_price": "",
                    "barcode": "",
                    "inventory_qty": "",
                })
                row_count += 1
    print(f"  Wrote {row_count} product variants → {out_path}")


def convert_customers(jsonl_path: str, output_dir: str):
    """Convert customers JSONL to CSV."""
    records = parse_jsonl(jsonl_path)
    if not records:
        print("  No customer records to convert")
        return

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "customers.csv")
    fields = [
        "customer_id", "email", "first_name", "last_name",
        "created_at", "orders_count", "total_spent", "state",
        "city", "province", "country", "tags",
    ]

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for c in records:
            addr = c.get("defaultAddress") or {}
            writer.writerow({
                "customer_id": c.get("id", ""),
                "email": c.get("email", ""),
                "first_name": c.get("firstName", ""),
                "last_name": c.get("lastName", ""),
                "created_at": c.get("createdAt", ""),
                "orders_count": c.get("numberOfOrders", ""),
                "total_spent": safe_money(c, "amountSpent", "amount") or c.get("totalSpent", ""),
                "state": c.get("state", ""),
                "city": addr.get("city", ""),
                "province": addr.get("provinceCode", ""),
                "country": addr.get("country", ""),
                "tags": ", ".join(c.get("tags") or []) if isinstance(c.get("tags"), list) else c.get("tags", ""),
            })
    print(f"  Wrote {len(records)} customers → {out_path}")


def convert_payouts(jsonl_path: str, output_dir: str):
    """Convert payouts JSONL to CSV for bank reconciliation."""
    records = parse_jsonl(jsonl_path)
    if not records:
        print("  No payout records to convert")
        return

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "payouts.csv")
    fields = [
        "payout_id", "issued_at", "status", "transaction_type",
        "net_amount", "currency",
        "charges_gross", "charges_fee",
        "refunds_fee_gross", "adjustments_gross",
    ]

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for p in records:
            summary = p.get("summary") or {}
            writer.writerow({
                "payout_id": p.get("id", ""),
                "issued_at": p.get("issuedAt", ""),
                "status": p.get("status", ""),
                "transaction_type": p.get("transactionType", ""),
                "net_amount": safe_money(p, "net", "amount"),
                "currency": safe_get(p, "net", "currencyCode"),
                "charges_gross": safe_money(summary, "chargesGross", "amount"),
                "charges_fee": safe_money(summary, "chargesFee", "amount"),
                "refunds_fee_gross": safe_money(summary, "refundsFeeGross", "amount"),
                "adjustments_gross": safe_money(summary, "adjustmentsGross", "amount"),
            })
    print(f"  Wrote {len(records)} payouts → {out_path}")

    # ── Monthly payout summary for reconciliation ──
    monthly = defaultdict(lambda: {
        "net": 0.0, "charges_gross": 0.0, "charges_fee": 0.0,
        "refunds_fee_gross": 0.0, "adjustments": 0.0, "count": 0,
    })
    for p in records:
        issued = p.get("issuedAt", "")
        if not issued:
            continue
        month = issued[:7]
        summary = p.get("summary") or {}
        m = monthly[month]
        m["net"] += safe_money(p, "net", "amount") or 0
        m["charges_gross"] += safe_money(summary, "chargesGross", "amount") or 0
        m["charges_fee"] += safe_money(summary, "chargesFee", "amount") or 0
        m["refunds_fee_gross"] += safe_money(summary, "refundsFeeGross", "amount") or 0
        m["adjustments"] += safe_money(summary, "adjustmentsGross", "amount") or 0
        m["count"] += 1

    monthly_path = os.path.join(output_dir, "monthly_payouts.csv")
    with open(monthly_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Month", "Net_Deposited", "Charges_Gross", "Charges_Fee",
            "Refunds_Fee_Gross", "Adjustments", "Payout_Count",
        ])
        for month in sorted(monthly.keys()):
            m = monthly[month]
            writer.writerow([
                month,
                round(m["net"], 2),
                round(m["charges_gross"], 2),
                round(m["charges_fee"], 2),
                round(m["refunds_fee_gross"], 2),
                round(m["adjustments"], 2),
                m["count"],
            ])
    print(f"  Wrote {len(monthly)} months → {monthly_path}")


# ═══════════════════════════════════════════════
# RECONCILIATION HELPER
# ═══════════════════════════════════════════════

def generate_reconciliation_report(output_dir: str):
    """Generate a Shopify ↔ QBO reconciliation comparison file."""
    monthly_rev_path = os.path.join(output_dir, "monthly_shopify_revenue.csv")
    monthly_pay_path = os.path.join(output_dir, "monthly_payouts.csv")
    qbo_path = os.path.join(
        os.path.dirname(output_dir),
        "output", "derived_reports", "monthly_revenue_by_channel.csv"
    )

    if not os.path.exists(monthly_rev_path) or not os.path.exists(qbo_path):
        print("  Skipping reconciliation — missing data files")
        return

    # Load Shopify monthly revenue
    shopify_rev = {}
    with open(monthly_rev_path, "r") as f:
        for row in csv.DictReader(f):
            shopify_rev[row["Month"]] = {
                "gross": float(row["Gross_Revenue"]),
                "net": float(row["Net_Revenue"]),
                "refunded": float(row["Refunded"]),
                "orders": int(row["Order_Count"]),
            }

    # Load Shopify monthly payouts
    shopify_pay = {}
    if os.path.exists(monthly_pay_path):
        with open(monthly_pay_path, "r") as f:
            for row in csv.DictReader(f):
                shopify_pay[row["Month"]] = float(row["Net_Deposited"])

    # Load QBO revenue (Shopify column from existing derived report)
    qbo_rev = {}
    with open(qbo_path, "r") as f:
        for row in csv.DictReader(f):
            qbo_rev[row["Month"]] = float(row.get("Shopify", 0))

    # Build comparison
    all_months = sorted(set(list(shopify_rev.keys()) + list(qbo_rev.keys())))
    recon_path = os.path.join(output_dir, "shopify_qbo_reconciliation.csv")

    with open(recon_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Month",
            "Shopify_Gross_Revenue", "Shopify_Refunded", "Shopify_Net_Revenue",
            "Shopify_Payout_Deposited",
            "QBO_Shopify_Revenue",
            "Variance_Net_vs_QBO", "Variance_Payout_vs_QBO",
            "Order_Count",
        ])
        for month in all_months:
            s = shopify_rev.get(month, {"gross": 0, "net": 0, "refunded": 0, "orders": 0})
            p = shopify_pay.get(month, 0)
            q = qbo_rev.get(month, 0)
            writer.writerow([
                month,
                round(s["gross"], 2),
                round(s["refunded"], 2),
                round(s["net"], 2),
                round(p, 2),
                round(q, 2),
                round(s["net"] - q, 2),
                round(p - q, 2),
                s["orders"],
            ])
    print(f"  Wrote reconciliation → {recon_path}")


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════

CONVERTERS = {
    "orders": convert_orders,
    "products": convert_products,
    "customers": convert_customers,
    "payouts": convert_payouts,
}

AVAILABLE = list(get_queries().keys())


def main():
    parser = argparse.ArgumentParser(
        description="MonsterBass Shopify data extraction for financial audit"
    )
    parser.add_argument(
        "extractions", nargs="*", default=AVAILABLE,
        help=f"Which extractions to run. Options: {', '.join(AVAILABLE)}",
    )
    parser.add_argument("--list", action="store_true", help="List available extractions")
    parser.add_argument("--test", action="store_true", help="Test API connection only")
    parser.add_argument("--convert-only", action="store_true",
                        help="Skip extraction, just convert existing JSONL files to CSV")
    parser.add_argument("--get-token", action="store_true",
                        help="Exchange client credentials for access token and save to .env")
    args = parser.parse_args()

    if args.list:
        print("Available extractions:")
        for name in AVAILABLE:
            print(f"  - {name}")
        return

    # Resolve access token (from .env or via client credentials exchange)
    token = resolve_access_token()

    if args.get_token:
        print("Token saved. You can now run extractions.")
        return

    client = ShopifyClient(SHOP_NAME, token, API_VERSION)

    if args.test:
        print("Testing API connection...")
        result = client.test_connection()
        shop = result["data"]["shop"]
        print(f"  Connected to: {shop['name']}")
        print(f"  Domain: {shop['myshopifyDomain']}")
        print(f"  Plan: {shop['plan']['displayName']}")
        print(f"  Currency: {shop['currencyCode']}")
        print("\nConnection successful.")
        return

    queries = get_queries()
    runner = BulkOperationRunner(client)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    print(f"\nMonsterBass Shopify Extraction")
    print(f"Audit period: {AUDIT_START} → {AUDIT_END}")
    print(f"Timestamp: {timestamp}")
    print(f"Extractions: {', '.join(args.extractions)}")

    # Validate extraction names
    for name in args.extractions:
        if name not in queries:
            print(f"ERROR: Unknown extraction '{name}'. Available: {', '.join(AVAILABLE)}")
            sys.exit(1)

    if not args.convert_only:
        # Run extractions sequentially (Shopify limits concurrent bulk ops on older API)
        for name in args.extractions:
            try:
                runner.run(name, queries[name])
            except Exception as e:
                print(f"  ERROR extracting {name}: {e}")
                print(f"  Continuing with remaining extractions...")

    # Convert JSONL → CSV
    print(f"\n{'='*60}")
    print("CONVERTING JSONL → CSV")
    print(f"{'='*60}")

    for name in args.extractions:
        jsonl_path = os.path.join(RAW_DIR, f"{name}.jsonl")
        if not os.path.exists(jsonl_path):
            print(f"\n  Skipping {name} — no JSONL file found")
            continue
        print(f"\nConverting {name}...")
        converter = CONVERTERS.get(name)
        if converter:
            converter(jsonl_path, OUTPUT_DIR)

    # Generate reconciliation report if we have orders data
    if "orders" in args.extractions:
        print(f"\n{'='*60}")
        print("GENERATING RECONCILIATION REPORT")
        print(f"{'='*60}")
        generate_reconciliation_report(OUTPUT_DIR)

    print(f"\n{'='*60}")
    print("EXTRACTION COMPLETE")
    print(f"{'='*60}")
    print(f"Raw JSONL files: {RAW_DIR}/")
    print(f"Cleaned CSVs:    {OUTPUT_DIR}/")
    print(f"\nNext steps:")
    print(f"  1. Review shopify_cleaned/shopify_qbo_reconciliation.csv")
    print(f"  2. Match SKUs in sku_revenue_summary.csv with legacy cost data")
    print(f"  3. Check Shopify Capital terms in Admin → Finance → Capital")


if __name__ == "__main__":
    main()
