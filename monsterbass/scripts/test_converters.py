#!/usr/bin/env python3
"""
Smoke test for JSONL → CSV converters.

Generates mock Shopify bulk operation JSONL data and verifies the converters
produce correct CSV output. Run with: python3 scripts/test_converters.py
"""

import os
import sys
import json
import csv
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shopify_extract import (
    parse_jsonl, convert_orders, convert_products,
    convert_customers, convert_payouts, safe_money, safe_get,
)


def write_jsonl(path, objects):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        for obj in objects:
            f.write(json.dumps(obj) + "\n")


def read_csv_rows(path):
    with open(path, "r") as f:
        return list(csv.DictReader(f))


def test_safe_helpers():
    """Test safe_money and safe_get edge cases."""
    assert safe_money({"a": {"b": "123.45"}}, "a", "b") == 123.45
    assert safe_money(None, "a") is None
    assert safe_money({"a": None}, "a", "b") is None
    assert safe_money({"a": {"b": "not_a_number"}}, "a", "b") is None

    assert safe_get({"a": {"b": "val"}}, "a", "b") == "val"
    assert safe_get(None, "a") == ""
    assert safe_get({"a": None}, "a", "b") == ""
    print("  safe_helpers: PASS")


def test_parse_jsonl_parent_child():
    """Test that JSONL parent-child reconstruction works."""
    tmpdir = tempfile.mkdtemp()
    try:
        path = os.path.join(tmpdir, "test.jsonl")
        write_jsonl(path, [
            {"id": "gid://shopify/Order/1", "name": "#1001"},
            {"id": "gid://shopify/LineItem/10", "__parentId": "gid://shopify/Order/1", "sku": "SKU-A", "quantity": 2},
            {"id": "gid://shopify/LineItem/11", "__parentId": "gid://shopify/Order/1", "sku": "SKU-B", "quantity": 1},
            {"id": "gid://shopify/Order/2", "name": "#1002"},
            {"id": "gid://shopify/LineItem/20", "__parentId": "gid://shopify/Order/2", "sku": "SKU-A", "quantity": 5},
        ])
        roots = parse_jsonl(path)
        assert len(roots) == 2, f"Expected 2 root orders, got {len(roots)}"
        assert roots[0]["name"] == "#1001"
        assert len(roots[0]["__children"]) == 2
        assert roots[0]["__children"][0]["sku"] == "SKU-A"
        assert roots[1]["__children"][0]["quantity"] == 5
        print("  parse_jsonl parent-child: PASS")
    finally:
        shutil.rmtree(tmpdir)


def test_convert_orders():
    """Test order conversion produces expected CSV files."""
    tmpdir = tempfile.mkdtemp()
    try:
        jsonl_path = os.path.join(tmpdir, "orders.jsonl")
        out_dir = os.path.join(tmpdir, "output")

        write_jsonl(jsonl_path, [
            {
                "id": "gid://shopify/Order/100",
                "name": "#1001",
                "createdAt": "2024-03-15T10:30:00Z",
                "processedAt": "2024-03-15T10:30:00Z",
                "closedAt": None,
                "cancelledAt": None,
                "displayFinancialStatus": "PAID",
                "displayFulfillmentStatus": "FULFILLED",
                "totalPriceSet": {"shopMoney": {"amount": "299.99", "currencyCode": "USD"}},
                "currentTotalPriceSet": {"shopMoney": {"amount": "299.99", "currencyCode": "USD"}},
                "subtotalPriceSet": {"shopMoney": {"amount": "279.99", "currencyCode": "USD"}},
                "totalShippingPriceSet": {"shopMoney": {"amount": "10.00", "currencyCode": "USD"}},
                "totalTaxSet": {"shopMoney": {"amount": "10.00", "currencyCode": "USD"}},
                "totalDiscountsSet": {"shopMoney": {"amount": "0.00", "currencyCode": "USD"}},
                "totalRefundedSet": {"shopMoney": {"amount": "0.00", "currencyCode": "USD"}},
                "netPaymentSet": {"shopMoney": {"amount": "299.99", "currencyCode": "USD"}},
                "paymentGatewayNames": ["shopify_payments"],
                "tags": ["subscription"],
                "note": None,
                "customer": {"id": "gid://shopify/Customer/1", "email": "test@example.com", "firstName": "John", "lastName": "Doe"},
            },
            # Line item child
            {
                "id": "gid://shopify/LineItem/200",
                "__parentId": "gid://shopify/Order/100",
                "__typename": "LineItem",
                "name": "Dirty Dancer - Bone",
                "sku": "DD-BONE-001",
                "quantity": 1,
                "originalTotalSet": {"shopMoney": {"amount": "279.99", "currencyCode": "USD"}},
                "discountedTotalSet": {"shopMoney": {"amount": "279.99", "currencyCode": "USD"}},
                "variant": {"id": "gid://shopify/ProductVariant/300", "sku": "DD-BONE-001", "price": "279.99", "barcode": "675162131789", "product": {"id": "gid://shopify/Product/400", "productType": "Lure"}},
            },
            # Second order with a refund (refunds embedded as plain list)
            {
                "id": "gid://shopify/Order/101",
                "name": "#1002",
                "createdAt": "2024-03-20T14:00:00Z",
                "processedAt": "2024-03-20T14:00:00Z",
                "closedAt": None,
                "cancelledAt": None,
                "displayFinancialStatus": "PARTIALLY_REFUNDED",
                "displayFulfillmentStatus": "FULFILLED",
                "totalPriceSet": {"shopMoney": {"amount": "150.00", "currencyCode": "USD"}},
                "currentTotalPriceSet": {"shopMoney": {"amount": "100.00", "currencyCode": "USD"}},
                "subtotalPriceSet": {"shopMoney": {"amount": "140.00", "currencyCode": "USD"}},
                "totalShippingPriceSet": {"shopMoney": {"amount": "10.00", "currencyCode": "USD"}},
                "totalTaxSet": {"shopMoney": {"amount": "0.00", "currencyCode": "USD"}},
                "totalDiscountsSet": {"shopMoney": {"amount": "0.00", "currencyCode": "USD"}},
                "totalRefundedSet": {"shopMoney": {"amount": "50.00", "currencyCode": "USD"}},
                "netPaymentSet": {"shopMoney": {"amount": "100.00", "currencyCode": "USD"}},
                "paymentGatewayNames": ["shopify_payments"],
                "tags": [],
                "note": None,
                "customer": {"id": "gid://shopify/Customer/2", "email": "jane@example.com", "firstName": "Jane", "lastName": "Smith"},
                "refunds": [
                    {
                        "id": "gid://shopify/Refund/500",
                        "createdAt": "2024-03-25T09:00:00Z",
                        "note": "Customer return",
                        "totalRefundedSet": {"shopMoney": {"amount": "50.00", "currencyCode": "USD"}},
                    }
                ],
                "transactions": [
                    {
                        "id": "gid://shopify/OrderTransaction/700",
                        "kind": "SALE",
                        "status": "SUCCESS",
                        "processedAt": "2024-03-20T14:00:00Z",
                        "amountSet": {"shopMoney": {"amount": "150.00", "currencyCode": "USD"}},
                        "gateway": "shopify_payments",
                    }
                ],
            },
            # Line item for order 101
            {
                "id": "gid://shopify/LineItem/201",
                "__parentId": "gid://shopify/Order/101",
                "__typename": "LineItem",
                "name": "Bass Rod Pro",
                "sku": "BR-PRO-001",
                "quantity": 1,
                "originalTotalSet": {"shopMoney": {"amount": "140.00", "currencyCode": "USD"}},
                "discountedTotalSet": {"shopMoney": {"amount": "140.00", "currencyCode": "USD"}},
                "variant": {"id": "gid://shopify/ProductVariant/301", "sku": "BR-PRO-001", "price": "140.00", "barcode": "123456789", "product": {"id": "gid://shopify/Product/401", "productType": "Rod"}},
            },
        ])

        convert_orders(jsonl_path, out_dir)

        # Verify orders_summary.csv
        rows = read_csv_rows(os.path.join(out_dir, "orders_summary.csv"))
        assert len(rows) == 2, f"Expected 2 orders, got {len(rows)}"
        assert rows[0]["order_name"] == "#1001"
        assert float(rows[0]["total_price"]) == 299.99
        assert rows[1]["financial_status"] == "PARTIALLY_REFUNDED"
        assert float(rows[1]["total_refunded"]) == 50.0

        # Verify line items
        rows = read_csv_rows(os.path.join(out_dir, "order_line_items.csv"))
        assert len(rows) == 2, f"Expected 2 line items, got {len(rows)}"
        assert rows[0]["sku"] == "DD-BONE-001"
        assert rows[0]["barcode"] == "675162131789"

        # Verify refunds (bulk operations can't include refundLineItems,
        # so we only have aggregate refund totals per refund event)
        rows = read_csv_rows(os.path.join(out_dir, "refunds_detail.csv"))
        assert len(rows) == 1, f"Expected 1 refund record, got {len(rows)}"
        assert float(rows[0]["refund_total"]) == 50.0
        assert rows[0]["refund_note"] == "Customer return"
        assert rows[0]["refund_created_at"] == "2024-03-25T09:00:00Z"

        # Verify monthly aggregation
        rows = read_csv_rows(os.path.join(out_dir, "monthly_shopify_revenue.csv"))
        assert len(rows) == 1  # Both orders in 2024-03
        assert rows[0]["Month"] == "2024-03"
        assert float(rows[0]["Gross_Revenue"]) == 449.99
        assert int(rows[0]["Order_Count"]) == 2

        # Verify SKU summary
        rows = read_csv_rows(os.path.join(out_dir, "sku_revenue_summary.csv"))
        assert len(rows) == 2
        # Should be sorted by revenue descending
        assert rows[0]["SKU"] == "DD-BONE-001"
        assert float(rows[0]["Total_Revenue"]) == 279.99

        print("  convert_orders: PASS")
    finally:
        shutil.rmtree(tmpdir)


def test_convert_products():
    """Test product conversion."""
    tmpdir = tempfile.mkdtemp()
    try:
        jsonl_path = os.path.join(tmpdir, "products.jsonl")
        out_dir = os.path.join(tmpdir, "output")

        write_jsonl(jsonl_path, [
            {
                "id": "gid://shopify/Product/1",
                "title": "Dirty Dancer",
                "handle": "dirty-dancer",
                "productType": "Lure",
                "vendor": "MonsterBass",
                "status": "ACTIVE",
                "createdAt": "2023-01-01T00:00:00Z",
                "tags": ["lure", "bass"],
            },
            {
                "id": "gid://shopify/ProductVariant/10",
                "__parentId": "gid://shopify/Product/1",
                "title": "Bone",
                "sku": "DD-BONE-001",
                "price": "19.99",
                "compareAtPrice": "24.99",
                "barcode": "675162131789",
                "inventoryQuantity": 150,
                "weight": 2.0,
                "weightUnit": "OUNCES",
            },
            {
                "id": "gid://shopify/ProductVariant/11",
                "__parentId": "gid://shopify/Product/1",
                "title": "Chartreuse",
                "sku": "DD-CHART-001",
                "price": "19.99",
                "compareAtPrice": None,
                "barcode": "675162131790",
                "inventoryQuantity": 75,
                "weight": 2.0,
                "weightUnit": "OUNCES",
            },
        ])

        convert_products(jsonl_path, out_dir)

        rows = read_csv_rows(os.path.join(out_dir, "products_catalog.csv"))
        assert len(rows) == 2, f"Expected 2 variants, got {len(rows)}"
        assert rows[0]["title"] == "Dirty Dancer"
        assert rows[0]["sku"] == "DD-BONE-001"
        assert rows[1]["variant_title"] == "Chartreuse"
        print("  convert_products: PASS")
    finally:
        shutil.rmtree(tmpdir)


def test_convert_customers():
    """Test customer conversion."""
    tmpdir = tempfile.mkdtemp()
    try:
        jsonl_path = os.path.join(tmpdir, "customers.jsonl")
        out_dir = os.path.join(tmpdir, "output")

        write_jsonl(jsonl_path, [
            {
                "id": "gid://shopify/Customer/1",
                "email": "john@example.com",
                "firstName": "John",
                "lastName": "Doe",
                "createdAt": "2024-01-15T00:00:00Z",
                "ordersCount": 5,
                "totalSpent": "1299.95",
                "state": "ENABLED",
                "tags": ["vip"],
                "defaultAddress": {"city": "Austin", "provinceCode": "TX", "country": "US"},
            },
        ])

        convert_customers(jsonl_path, out_dir)

        rows = read_csv_rows(os.path.join(out_dir, "customers.csv"))
        assert len(rows) == 1
        assert rows[0]["email"] == "john@example.com"
        assert rows[0]["city"] == "Austin"
        assert rows[0]["province"] == "TX"
        print("  convert_customers: PASS")
    finally:
        shutil.rmtree(tmpdir)


def test_convert_payouts():
    """Test payout conversion."""
    tmpdir = tempfile.mkdtemp()
    try:
        jsonl_path = os.path.join(tmpdir, "payouts.jsonl")
        out_dir = os.path.join(tmpdir, "output")

        write_jsonl(jsonl_path, [
            {
                "id": "gid://shopify/ShopifyPaymentsPayout/1",
                "issuedAt": "2024-03-15T00:00:00Z",
                "net": {"amount": "1500.00", "currencyCode": "USD"},
                "status": "PAID",
                "transactionType": "DEPOSIT",
                "summary": {
                    "chargesGross": {"amount": "1600.00", "currencyCode": "USD"},
                    "chargesFee": {"amount": "46.40", "currencyCode": "USD"},
                    "refundsFeeGross": {"amount": "-50.00", "currencyCode": "USD"},
                    "adjustmentsGross": {"amount": "-3.60", "currencyCode": "USD"},
                },
            },
            {
                "id": "gid://shopify/ShopifyPaymentsPayout/2",
                "issuedAt": "2024-03-18T00:00:00Z",
                "net": {"amount": "2200.00", "currencyCode": "USD"},
                "status": "PAID",
                "transactionType": "DEPOSIT",
                "summary": {
                    "chargesGross": {"amount": "2300.00", "currencyCode": "USD"},
                    "chargesFee": {"amount": "66.70", "currencyCode": "USD"},
                    "refundsFeeGross": {"amount": "0.00", "currencyCode": "USD"},
                    "adjustmentsGross": {"amount": "-33.30", "currencyCode": "USD"},
                },
            },
        ])

        convert_payouts(jsonl_path, out_dir)

        rows = read_csv_rows(os.path.join(out_dir, "payouts.csv"))
        assert len(rows) == 2
        assert float(rows[0]["net_amount"]) == 1500.0
        assert float(rows[0]["charges_gross"]) == 1600.0

        monthly = read_csv_rows(os.path.join(out_dir, "monthly_payouts.csv"))
        assert len(monthly) == 1  # Both in 2024-03
        assert float(monthly[0]["Net_Deposited"]) == 3700.0
        assert int(monthly[0]["Payout_Count"]) == 2
        print("  convert_payouts: PASS")
    finally:
        shutil.rmtree(tmpdir)


if __name__ == "__main__":
    print("\nRunning converter tests...\n")
    test_safe_helpers()
    test_parse_jsonl_parent_child()
    test_convert_orders()
    test_convert_products()
    test_convert_customers()
    test_convert_payouts()
    print("\nAll tests passed.\n")
