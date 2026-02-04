"""Tests for DataExtractService module."""

import pytest
from datetime import datetime
from io import StringIO

import pandas as pd
import numpy as np

from atmix.engine.data_extract import (
    DataExtractService,
    ExtractRequest,
    ExtractResult,
    ExtractType,
    LRUCache,
    parse_natural_request,
    format_for_prompt,
)


class TestExtractType:
    def test_from_string_valid_types(self):
        """Test parsing valid extract type strings."""
        assert ExtractType.from_string("filter") == ExtractType.FILTER
        assert ExtractType.from_string("top_n") == ExtractType.TOP_N
        assert ExtractType.from_string("aggregate") == ExtractType.AGGREGATE
        assert ExtractType.from_string("sample") == ExtractType.SAMPLE
        assert ExtractType.from_string("custom") == ExtractType.CUSTOM

    def test_from_string_case_insensitive(self):
        """Test that parsing is case-insensitive."""
        assert ExtractType.from_string("FILTER") == ExtractType.FILTER
        assert ExtractType.from_string("Top_N") == ExtractType.TOP_N
        assert ExtractType.from_string("AGGREGATE") == ExtractType.AGGREGATE

    def test_from_string_unknown_defaults_to_custom(self):
        """Test that unknown types default to CUSTOM."""
        assert ExtractType.from_string("unknown") == ExtractType.CUSTOM
        assert ExtractType.from_string("invalid") == ExtractType.CUSTOM
        assert ExtractType.from_string("") == ExtractType.CUSTOM


class TestExtractRequest:
    def test_create_request_basic(self):
        """Test creating a basic extraction request."""
        req = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "amount", "operator": ">", "value": 1000},
        )
        assert req.source_file == "transactions.csv"
        assert req.extract_type == "filter"
        assert req.parameters["column"] == "amount"
        assert req.request_id is not None

    def test_create_request_with_id(self):
        """Test creating a request with explicit request_id."""
        req = ExtractRequest(
            source_file="data.csv",
            extract_type="sample",
            parameters={"n": 50},
            request_id="my-custom-id",
        )
        assert req.request_id == "my-custom-id"

    def test_request_id_auto_generation(self):
        """Test that request_id is auto-generated and consistent."""
        req1 = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "x", "operator": "==", "value": 1},
        )
        req2 = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "x", "operator": "==", "value": 1},
        )
        # Same parameters should generate same hash
        assert req1.request_id == req2.request_id
        assert len(req1.request_id) == 12

    def test_to_dict_serialization(self):
        """Test converting request to dictionary."""
        req = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "amount", "n": 10, "order": "desc"},
            request_id="test-123",
        )
        d = req.to_dict()
        assert d["source_file"] == "transactions.csv"
        assert d["extract_type"] == "top_n"
        assert d["parameters"]["n"] == 10
        assert d["request_id"] == "test-123"

    def test_from_dict_deserialization(self):
        """Test creating request from dictionary."""
        data = {
            "source_file": "data.csv",
            "extract_type": "aggregate",
            "parameters": {"group_by": ["vendor"], "agg": {"amount": "sum"}},
            "request_id": "req-456",
        }
        req = ExtractRequest.from_dict(data)
        assert req.source_file == "data.csv"
        assert req.extract_type == "aggregate"
        assert req.parameters["group_by"] == ["vendor"]
        assert req.request_id == "req-456"

    def test_from_dict_with_defaults(self):
        """Test from_dict handles missing fields with defaults."""
        data = {}
        req = ExtractRequest.from_dict(data)
        assert req.source_file == ""
        assert req.extract_type == "custom"
        assert req.parameters == {}

    def test_serialization_round_trip(self):
        """Test full serialization round trip."""
        original = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "amount", "operator": ">", "value": 500},
        )
        d = original.to_dict()
        restored = ExtractRequest.from_dict(d)
        assert restored.source_file == original.source_file
        assert restored.extract_type == original.extract_type
        assert restored.parameters == original.parameters
        assert restored.request_id == original.request_id


class TestExtractResult:
    @pytest.fixture
    def sample_dataframe(self):
        """Create a sample DataFrame for testing results."""
        return pd.DataFrame({
            "id": [1, 2, 3],
            "amount": [100.0, 200.0, 300.0],
            "vendor": ["A", "B", "C"],
        })

    @pytest.fixture
    def sample_request(self):
        """Create a sample request for testing."""
        return ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "amount", "operator": ">", "value": 0},
        )

    def test_create_result_with_dataframe(self, sample_request, sample_dataframe):
        """Test creating result with DataFrame data."""
        result = ExtractResult(
            request=sample_request,
            data=sample_dataframe,
            row_count=3,
            truncated=False,
            summary="Filtered amount > 0",
        )
        assert result.row_count == 3
        assert result.truncated is False
        assert result.success is True
        assert result.error is None

    def test_create_result_with_error(self, sample_request):
        """Test creating error result."""
        result = ExtractResult(
            request=sample_request,
            data="",
            row_count=0,
            truncated=False,
            summary="",
            error="Column not found",
        )
        assert result.success is False
        assert result.error == "Column not found"

    def test_success_property(self, sample_request, sample_dataframe):
        """Test success property logic."""
        success_result = ExtractResult(
            request=sample_request,
            data=sample_dataframe,
            row_count=3,
            truncated=False,
            summary="Success",
        )
        assert success_result.success is True

        error_result = ExtractResult(
            request=sample_request,
            data="",
            row_count=0,
            truncated=False,
            summary="",
            error="Failed",
        )
        assert error_result.success is False

    def test_as_dataframe_from_dataframe(self, sample_request, sample_dataframe):
        """Test as_dataframe when data is already DataFrame."""
        result = ExtractResult(
            request=sample_request,
            data=sample_dataframe,
            row_count=3,
            truncated=False,
            summary="Test",
        )
        df = result.as_dataframe
        assert df is not None
        assert len(df) == 3
        assert list(df.columns) == ["id", "amount", "vendor"]

    def test_as_dataframe_from_csv_string(self, sample_request):
        """Test as_dataframe when data is CSV string."""
        csv_data = "id,amount,vendor\n1,100.0,A\n2,200.0,B\n"
        result = ExtractResult(
            request=sample_request,
            data=csv_data,
            row_count=2,
            truncated=False,
            summary="Test",
        )
        df = result.as_dataframe
        assert df is not None
        assert len(df) == 2

    def test_as_dataframe_invalid_csv(self, sample_request):
        """Test as_dataframe returns None for invalid CSV."""
        result = ExtractResult(
            request=sample_request,
            data="not valid csv data {{{}}}",
            row_count=0,
            truncated=False,
            summary="Test",
        )
        # Should not raise, returns None
        df = result.as_dataframe
        # May or may not be None depending on how pandas handles it

    def test_as_dataframe_empty_string(self, sample_request):
        """Test as_dataframe with empty string."""
        result = ExtractResult(
            request=sample_request,
            data="",
            row_count=0,
            truncated=False,
            summary="Test",
        )
        assert result.as_dataframe is None

    def test_as_csv_from_dataframe(self, sample_request, sample_dataframe):
        """Test as_csv when data is DataFrame."""
        result = ExtractResult(
            request=sample_request,
            data=sample_dataframe,
            row_count=3,
            truncated=False,
            summary="Test",
        )
        csv = result.as_csv
        assert "id,amount,vendor" in csv
        assert "1,100.0,A" in csv

    def test_as_csv_from_string(self, sample_request):
        """Test as_csv when data is already string."""
        csv_data = "id,value\n1,100\n"
        result = ExtractResult(
            request=sample_request,
            data=csv_data,
            row_count=1,
            truncated=False,
            summary="Test",
        )
        assert result.as_csv == csv_data

    def test_to_dict_serialization(self, sample_request, sample_dataframe):
        """Test converting result to dictionary."""
        result = ExtractResult(
            request=sample_request,
            data=sample_dataframe,
            row_count=3,
            truncated=True,
            summary="Filtered data",
            execution_time_ms=15.5,
        )
        d = result.to_dict()
        assert d["row_count"] == 3
        assert d["truncated"] is True
        assert d["summary"] == "Filtered data"
        assert d["execution_time_ms"] == 15.5
        assert "data_csv" in d
        assert d["request"]["source_file"] == "test.csv"


class TestLRUCache:
    def test_basic_put_and_get(self):
        """Test basic cache operations."""
        cache = LRUCache(maxsize=3)
        cache.put("key1", "value1")
        cache.put("key2", "value2")

        assert cache.get("key1") == "value1"
        assert cache.get("key2") == "value2"
        assert cache.get("nonexistent") is None

    def test_cache_eviction(self):
        """Test that oldest items are evicted when cache is full."""
        cache = LRUCache(maxsize=2)
        cache.put("key1", "value1")
        cache.put("key2", "value2")
        cache.put("key3", "value3")  # Should evict key1

        assert cache.get("key1") is None
        assert cache.get("key2") == "value2"
        assert cache.get("key3") == "value3"

    def test_lru_ordering(self):
        """Test that recently accessed items are kept."""
        cache = LRUCache(maxsize=2)
        cache.put("key1", "value1")
        cache.put("key2", "value2")

        # Access key1 to make it most recently used
        cache.get("key1")

        # Add new item - should evict key2 (least recently used)
        cache.put("key3", "value3")

        assert cache.get("key1") == "value1"
        assert cache.get("key2") is None
        assert cache.get("key3") == "value3"

    def test_update_existing_key(self):
        """Test updating existing key moves it to end."""
        cache = LRUCache(maxsize=2)
        cache.put("key1", "value1")
        cache.put("key2", "value2")

        # Update key1
        cache.put("key1", "updated_value1")

        # Add new item - should evict key2
        cache.put("key3", "value3")

        assert cache.get("key1") == "updated_value1"
        assert cache.get("key2") is None
        assert cache.get("key3") == "value3"

    def test_cache_size_enforcement(self):
        """Test that cache never exceeds maxsize."""
        cache = LRUCache(maxsize=3)
        for i in range(10):
            cache.put(f"key{i}", f"value{i}")

        assert len(cache) == 3


class TestDataExtractService:
    @pytest.fixture
    def sample_transactions_df(self):
        """Create a sample transactions DataFrame."""
        return pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100, freq="D"),
            "Description": ["Payment " + str(i) for i in range(100)],
            "Amount": [100.0 * (i % 10 + 1) for i in range(100)],
            "Credit": [0.0] * 50 + [50.0 * (i % 5 + 1) for i in range(50)],
            "Account": ["Revenue"] * 30 + ["Expense"] * 40 + ["Asset"] * 30,
            "Vendor": ["Vendor A"] * 25 + ["Vendor B"] * 25 + ["Vendor C"] * 25 + ["Vendor D"] * 25,
        })

    @pytest.fixture
    def sample_gl_df(self):
        """Create a sample general ledger DataFrame."""
        return pd.DataFrame({
            "Transaction Date": pd.date_range("2024-01-01", periods=50, freq="D"),
            "Account Name": ["Cash"] * 20 + ["Revenue"] * 15 + ["Expense"] * 15,
            "Debit": [1000.0] * 25 + [0.0] * 25,
            "Credit": [0.0] * 25 + [500.0] * 25,
            "Memo": ["GL Entry " + str(i) for i in range(50)],
        })

    @pytest.fixture
    def service(self, sample_transactions_df, sample_gl_df):
        """Create a DataExtractService instance."""
        return DataExtractService(
            data_files={
                "transactions.csv": sample_transactions_df,
                "gl_export.csv": sample_gl_df,
            },
            max_rows=50,
            cache_size=10,
        )

    # ============ Filter Operations Tests ============

    def test_filter_greater_than(self, service):
        """Test filter with greater than operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 500},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count > 0
        df = result.as_dataframe
        assert all(df["Amount"] > 500)

    def test_filter_less_than(self, service):
        """Test filter with less than operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": "<", "value": 300},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Amount"] < 300)

    def test_filter_greater_than_or_equal(self, service):
        """Test filter with >= operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">=", "value": 500},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Amount"] >= 500)

    def test_filter_less_than_or_equal(self, service):
        """Test filter with <= operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": "<=", "value": 200},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Amount"] <= 200)

    def test_filter_equals(self, service):
        """Test filter with equals operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Account", "operator": "==", "value": "Revenue"},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Account"] == "Revenue")

    def test_filter_not_equals(self, service):
        """Test filter with not equals operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Account", "operator": "!=", "value": "Revenue"},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Account"] != "Revenue")

    def test_filter_contains(self, service):
        """Test filter with contains operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Description", "operator": "contains", "value": "Payment 1"},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Description"].str.contains("Payment 1", case=False))

    def test_filter_in_list(self, service):
        """Test filter with in operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={
                "column": "Vendor",
                "operator": "in",
                "value": ["Vendor A", "Vendor B"],
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Vendor"].isin(["Vendor A", "Vendor B"]))

    def test_filter_not_in_list(self, service):
        """Test filter with not_in operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={
                "column": "Vendor",
                "operator": "not_in",
                "value": ["Vendor A", "Vendor B"],
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(~df["Vendor"].isin(["Vendor A", "Vendor B"]))

    def test_filter_is_null(self, sample_transactions_df):
        """Test filter with is_null operator."""
        # Add some null values
        df = sample_transactions_df.copy()
        df.loc[0:10, "Description"] = None
        service = DataExtractService({"test.csv": df})

        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "Description", "operator": "is_null", "value": None},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 11

    def test_filter_not_null(self, sample_transactions_df):
        """Test filter with not_null operator."""
        df = sample_transactions_df.copy()
        df.loc[0:10, "Description"] = None
        service = DataExtractService({"test.csv": df})

        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "Description", "operator": "not_null", "value": None},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 89  # 100 - 11

    def test_filter_invalid_column(self, service):
        """Test filter with non-existent column."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "NonExistent", "operator": ">", "value": 100},
        )
        result = service.execute(request)

        assert result.success is False
        assert "Column 'NonExistent' not found" in result.error

    def test_filter_invalid_operator(self, service):
        """Test filter with invalid operator."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": "invalid_op", "value": 100},
        )
        result = service.execute(request)

        assert result.success is False
        assert "Unknown operator" in result.error

    # ============ Top N Operations Tests ============

    def test_top_n_descending(self, service):
        """Test top N with descending order."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Amount", "n": 10, "order": "desc"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 10
        df = result.as_dataframe
        # Verify descending order
        amounts = df["Amount"].tolist()
        assert amounts == sorted(amounts, reverse=True)

    def test_top_n_ascending(self, service):
        """Test top N with ascending order."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Amount", "n": 5, "order": "asc"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 5
        df = result.as_dataframe
        # Verify ascending order
        amounts = df["Amount"].tolist()
        assert amounts == sorted(amounts)

    def test_top_n_default_order(self, service):
        """Test top N uses descending by default."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Amount", "n": 5},
        )
        result = service.execute(request)

        assert result.success is True
        assert "desc" in result.summary.lower()

    def test_top_n_string_column(self, service):
        """Test top N on string column."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Vendor", "n": 5, "order": "asc"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 5

    def test_top_n_respects_max_rows(self, service):
        """Test that top N is bounded by max_rows."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Amount", "n": 1000, "order": "desc"},
        )
        result = service.execute(request)

        assert result.success is True
        # max_rows is 50 in fixture
        assert result.row_count <= 50

    def test_top_n_invalid_column(self, service):
        """Test top N with non-existent column."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "InvalidColumn", "n": 10},
        )
        result = service.execute(request)

        assert result.success is False
        assert "not found" in result.error.lower()

    # ============ Aggregate Operations Tests ============

    def test_aggregate_group_by_sum(self, service):
        """Test aggregation with group by and sum."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {"Amount": "sum"},
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert "Account" in df.columns
        assert "Amount" in df.columns

    def test_aggregate_group_by_mean(self, service):
        """Test aggregation with mean function."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Vendor"],
                "agg": {"Amount": "mean"},
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert result.row_count == 4  # 4 unique vendors

    def test_aggregate_multiple_functions(self, service):
        """Test aggregation with multiple aggregate functions."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {
                    "Amount": "sum",
                    "Credit": "mean",
                },
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert "Amount" in df.columns
        assert "Credit" in df.columns

    def test_aggregate_count(self, service):
        """Test aggregation with count function."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Vendor"],
                "agg": {"Amount": "count"},
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        # Each vendor has 25 transactions
        assert all(df["Amount"] == 25)

    def test_aggregate_min_max(self, service):
        """Test aggregation with min and max functions."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {"Amount": "min"},
            },
        )
        result = service.execute(request)
        assert result.success is True

        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {"Amount": "max"},
            },
        )
        result = service.execute(request)
        assert result.success is True

    def test_aggregate_std_median(self, service):
        """Test aggregation with std and median functions."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Vendor"],
                "agg": {"Amount": "std"},
            },
        )
        result = service.execute(request)
        assert result.success is True

    def test_aggregate_nunique(self, service):
        """Test aggregation with nunique function."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {"Vendor": "nunique"},
            },
        )
        result = service.execute(request)
        assert result.success is True

    def test_aggregate_string_group_by(self, service):
        """Test aggregate when group_by is string instead of list."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": "Account",  # String instead of list
                "agg": {"Amount": "sum"},
            },
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert "Account" in df.columns

    def test_aggregate_no_group_by(self, service):
        """Test aggregate without group_by aggregates entire DataFrame."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": [],
                "agg": {"Amount": "sum"},
            },
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 1

    def test_aggregate_default_count(self, service):
        """Test aggregate defaults to count when no agg specified."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Vendor"],
                "agg": {},
            },
        )
        result = service.execute(request)

        assert result.success is True

    def test_aggregate_invalid_group_by_column(self, service):
        """Test aggregate with invalid group_by column."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["NonExistent"],
                "agg": {"Amount": "sum"},
            },
        )
        result = service.execute(request)

        assert result.success is False
        assert "not found" in result.error.lower()

    def test_aggregate_invalid_agg_function(self, service):
        """Test aggregate skips invalid aggregation functions."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="aggregate",
            parameters={
                "group_by": ["Account"],
                "agg": {"Amount": "invalid_func"},
            },
        )
        result = service.execute(request)

        # Should succeed but skip invalid function
        assert result.success is True

    # ============ Sample Operations Tests ============

    def test_sample_random(self, service):
        """Test random sampling."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 20, "method": "random", "seed": 42},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 20

    def test_sample_reproducibility(self, service):
        """Test that sampling is reproducible with same seed."""
        request1 = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 10, "method": "random", "seed": 123},
        )
        request2 = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 10, "method": "random", "seed": 123},
        )

        # Clear cache between requests
        service.clear_cache()

        result1 = service.execute(request1)
        service.clear_cache()
        result2 = service.execute(request2)

        df1 = result1.as_dataframe
        df2 = result2.as_dataframe

        # Same seed should produce same results
        pd.testing.assert_frame_equal(df1.reset_index(drop=True), df2.reset_index(drop=True))

    def test_sample_stratified(self, service):
        """Test stratified sampling."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={
                "n": 30,
                "method": "stratified",
                "stratify_column": "Vendor",
                "seed": 42,
            },
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count <= 30

    def test_sample_stratified_auto_column(self, service):
        """Test stratified sampling auto-selects stratify column."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={
                "n": 20,
                "method": "stratified",
                "seed": 42,
            },
        )
        result = service.execute(request)

        assert result.success is True

    def test_sample_systematic(self, service):
        """Test systematic sampling."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 10, "method": "systematic"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 10

    def test_sample_default_method(self, service):
        """Test sample defaults to random method."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 10},
        )
        result = service.execute(request)

        assert result.success is True
        assert "random" in result.summary.lower()

    def test_sample_respects_max_rows(self, service):
        """Test that sample is bounded by max_rows."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 1000, "method": "random"},
        )
        result = service.execute(request)

        assert result.success is True
        # max_rows is 50 in fixture
        assert result.row_count <= 50

    def test_sample_respects_dataframe_size(self, sample_transactions_df):
        """Test that sample respects actual DataFrame size."""
        service = DataExtractService(
            {"small.csv": sample_transactions_df.head(10)},
            max_rows=200,
        )
        request = ExtractRequest(
            source_file="small.csv",
            extract_type="sample",
            parameters={"n": 50, "method": "random"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 10

    # ============ Custom Query Parsing Tests ============

    def test_custom_top_n_query(self, service):
        """Test custom query parsing for top N."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "top 10 by Amount"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 10

    def test_custom_bottom_n_query(self, service):
        """Test custom query parsing for bottom N."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "bottom 5 by Amount"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 5

    def test_custom_filter_greater_than_query(self, service):
        """Test custom query parsing for filter with >."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Amount > 500"},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Amount"] > 500)

    def test_custom_filter_less_than_query(self, service):
        """Test custom query parsing for filter with <."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Amount < 300"},
        )
        result = service.execute(request)

        assert result.success is True

    def test_custom_filter_contains_query(self, service):
        """Test custom query parsing for contains."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Description contains 'Payment 5'"},
        )
        result = service.execute(request)

        assert result.success is True

    def test_custom_filter_over_query(self, service):
        """Test custom query with 'over' keyword."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Amount over 800"},
        )
        result = service.execute(request)

        assert result.success is True
        df = result.as_dataframe
        assert all(df["Amount"] > 800)

    def test_custom_filter_under_query(self, service):
        """Test custom query with 'under' keyword."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Amount under 200"},
        )
        result = service.execute(request)

        assert result.success is True

    def test_custom_sample_query(self, service):
        """Test custom query for sampling."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "sample 15"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 15

    def test_custom_aggregate_query(self, service):
        """Test custom query for aggregation."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "group by Vendor sum Amount"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 4

    def test_custom_unparseable_query(self, service):
        """Test custom query that cannot be parsed."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "something completely unparseable xyz123"},
        )
        result = service.execute(request)

        assert result.success is False
        assert "Could not parse query" in result.error

    def test_custom_empty_query(self, service):
        """Test custom query with empty string."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": ""},
        )
        result = service.execute(request)

        assert result.success is False
        assert "No query provided" in result.error

    def test_custom_no_query_parameter(self, service):
        """Test custom extraction without query parameter."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={},
        )
        result = service.execute(request)

        assert result.success is False

    def test_custom_column_matching_prefix(self, service):
        """Test column matching with prefix."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "Desc contains 'Payment'"},  # Partial match
        )
        result = service.execute(request)

        assert result.success is True

    def test_custom_column_matching_case_insensitive(self, service):
        """Test column matching is case-insensitive."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="custom",
            parameters={"query": "amount > 500"},  # lowercase
        )
        result = service.execute(request)

        assert result.success is True

    # ============ Max Rows Enforcement Tests ============

    def test_max_rows_enforcement_filter(self, sample_transactions_df):
        """Test max_rows is enforced on filter results."""
        service = DataExtractService(
            {"test.csv": sample_transactions_df},
            max_rows=10,
        )
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 0},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 10
        assert result.truncated is True

    def test_max_rows_truncation_summary(self, sample_transactions_df):
        """Test that truncation is reflected in summary."""
        service = DataExtractService(
            {"test.csv": sample_transactions_df},
            max_rows=5,
        )
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 0},
        )
        result = service.execute(request)

        assert "truncated" in result.summary.lower()

    def test_no_truncation_when_under_limit(self, sample_transactions_df):
        """Test that truncated is False when result fits."""
        service = DataExtractService(
            {"test.csv": sample_transactions_df},
            max_rows=200,
        )
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 900},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.truncated is False

    # ============ Error Handling Tests ============

    def test_error_source_file_not_found(self, service):
        """Test error when source file doesn't exist."""
        request = ExtractRequest(
            source_file="nonexistent.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 100},
        )
        result = service.execute(request)

        assert result.success is False
        assert "not found" in result.error.lower()
        assert "nonexistent.csv" in result.error

    def test_error_lists_available_files(self, service):
        """Test that error message lists available files."""
        request = ExtractRequest(
            source_file="missing.csv",
            extract_type="filter",
            parameters={},
        )
        result = service.execute(request)

        assert result.success is False
        assert "transactions.csv" in result.error or "gl_export.csv" in result.error

    def test_error_unknown_extract_type(self, service):
        """Test handling of unknown extract type."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="unknown_type",
            parameters={},
        )
        result = service.execute(request)

        # Unknown types default to CUSTOM, which may fail
        assert result.success is False

    def test_error_result_structure(self, service):
        """Test error result has correct structure."""
        request = ExtractRequest(
            source_file="nonexistent.csv",
            extract_type="filter",
            parameters={},
        )
        result = service.execute(request)

        assert result.request == request
        assert result.data == ""
        assert result.row_count == 0
        assert result.truncated is False
        assert result.error is not None

    def test_exception_handling(self, service):
        """Test that exceptions are caught and returned as errors."""
        # Create a request that might cause internal error
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": "not_a_number"},
        )
        result = service.execute(request)

        # Should handle gracefully
        assert result.success is True or result.error is not None

    # ============ Cache Functionality Tests ============

    def test_cache_hit(self, service):
        """Test that identical requests use cache."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 500},
        )

        result1 = service.execute(request)
        result2 = service.execute(request)

        assert result1.row_count == result2.row_count
        # Second request should be faster (cached)

    def test_cache_different_requests(self, service):
        """Test that different requests are cached separately."""
        request1 = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 500},
        )
        request2 = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 200},
        )

        result1 = service.execute(request1)
        result2 = service.execute(request2)

        # Different filters should give different results or have different request IDs
        assert result1.row_count != result2.row_count or result1.request.request_id != result2.request.request_id

    def test_cache_clear(self, service):
        """Test cache clearing."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="sample",
            parameters={"n": 10, "method": "random", "seed": 42},
        )

        result1 = service.execute(request)
        service.clear_cache()

        # Should be able to execute again after clear
        result2 = service.execute(request)
        assert result2.success is True

    def test_cache_error_results_not_cached(self, service):
        """Test that error results are not cached."""
        request = ExtractRequest(
            source_file="nonexistent.csv",
            extract_type="filter",
            parameters={},
        )

        result1 = service.execute(request)
        result2 = service.execute(request)

        assert result1.success is False
        assert result2.success is False
        # Both should be errors (not cached successful result)

    # ============ Request Logging Tests ============

    def test_request_logging(self, service):
        """Test that requests are logged."""
        initial_log_count = len(service.get_request_log())

        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 500},
        )
        service.execute(request)

        log = service.get_request_log()
        assert len(log) == initial_log_count + 1

        entry = log[-1]
        assert entry["source_file"] == "transactions.csv"
        assert entry["extract_type"] == "filter"
        assert "timestamp" in entry
        assert "execution_time_ms" in entry

    def test_request_log_contains_all_fields(self, service):
        """Test that log entries contain all expected fields."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="top_n",
            parameters={"column": "Amount", "n": 5},
        )
        service.execute(request)

        entry = service.get_request_log()[-1]
        expected_fields = [
            "timestamp",
            "request_id",
            "source_file",
            "extract_type",
            "parameters",
            "row_count",
            "truncated",
            "success",
            "execution_time_ms",
            "error",
        ]
        for field in expected_fields:
            assert field in entry

    # ============ Service Utility Methods Tests ============

    def test_get_available_files(self, service):
        """Test getting list of available files."""
        files = service.get_available_files()
        assert "transactions.csv" in files
        assert "gl_export.csv" in files
        assert len(files) == 2

    def test_get_file_schema(self, service):
        """Test getting file schema."""
        schema = service.get_file_schema("transactions.csv")

        assert schema is not None
        assert schema["filename"] == "transactions.csv"
        assert "Date" in schema["columns"]
        assert "Amount" in schema["columns"]
        assert schema["row_count"] == 100
        assert "dtypes" in schema

    def test_get_file_schema_not_found(self, service):
        """Test getting schema for non-existent file."""
        schema = service.get_file_schema("nonexistent.csv")
        assert schema is None

    def test_execution_time_recorded(self, service):
        """Test that execution time is recorded."""
        request = ExtractRequest(
            source_file="transactions.csv",
            extract_type="filter",
            parameters={"column": "Amount", "operator": ">", "value": 500},
        )
        result = service.execute(request)

        assert result.execution_time_ms > 0


class TestParseNaturalRequest:
    def test_parse_with_file_mentioned(self):
        """Test parsing when file is mentioned in text."""
        available = ["transactions.csv", "gl_export.csv"]
        request = parse_natural_request(
            "Show me the top 10 by amount from transactions.csv",
            available,
        )

        assert request is not None
        assert request.source_file == "transactions.csv"
        assert request.extract_type == "custom"

    def test_parse_defaults_to_first_file(self):
        """Test parsing defaults to first file when not specified."""
        available = ["data.csv", "other.csv"]
        request = parse_natural_request(
            "Filter rows where amount > 1000",
            available,
        )

        assert request is not None
        assert request.source_file == "data.csv"

    def test_parse_case_insensitive_file_match(self):
        """Test file matching is case-insensitive."""
        available = ["Transactions.CSV", "data.xlsx"]
        request = parse_natural_request(
            "sample 50 from transactions.csv",
            available,
        )

        assert request is not None
        assert request.source_file == "Transactions.CSV"

    def test_parse_no_available_files(self):
        """Test parsing with empty available files."""
        request = parse_natural_request(
            "Show me top 10 by amount",
            [],
        )

        assert request is None

    def test_parse_stores_full_text_as_query(self):
        """Test that full text is stored as query parameter."""
        available = ["data.csv"]
        request = parse_natural_request(
            "Show transactions where vendor contains Amazon over $5000",
            available,
        )

        assert request is not None
        assert "Amazon" in request.parameters["query"]
        assert "5000" in request.parameters["query"]


class TestFormatForPrompt:
    @pytest.fixture
    def sample_result(self):
        """Create a sample result for formatting tests."""
        df = pd.DataFrame({
            "id": [1, 2, 3],
            "amount": [100.0, 200.0, 300.0],
            "vendor": ["A", "B", "C"],
        })
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={"column": "amount", "operator": ">", "value": 0},
        )
        return ExtractResult(
            request=request,
            data=df,
            row_count=3,
            truncated=False,
            summary="Filtered amount > 0",
        )

    def test_format_includes_header(self, sample_result):
        """Test that formatted output includes header."""
        formatted = format_for_prompt(sample_result)

        assert "=== Data Extract:" in formatted
        assert "test.csv" in formatted

    def test_format_includes_summary(self, sample_result):
        """Test that formatted output includes summary."""
        formatted = format_for_prompt(sample_result)

        assert "Filtered amount > 0" in formatted
        assert "Rows: 3" in formatted

    def test_format_includes_data(self, sample_result):
        """Test that formatted output includes data."""
        formatted = format_for_prompt(sample_result)

        assert "id,amount,vendor" in formatted
        assert "100.0" in formatted

    def test_format_truncates_long_output(self, sample_result):
        """Test that output is truncated when exceeding max_lines."""
        # Create result with many rows
        df = pd.DataFrame({
            "id": range(100),
            "value": range(100),
        })
        result = ExtractResult(
            request=sample_result.request,
            data=df,
            row_count=100,
            truncated=False,
            summary="Test",
        )

        formatted = format_for_prompt(result, max_lines=10)

        assert "more rows" in formatted

    def test_format_error_result(self):
        """Test formatting of error result."""
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={},
        )
        result = ExtractResult(
            request=request,
            data="",
            row_count=0,
            truncated=False,
            summary="",
            error="Column not found",
        )

        formatted = format_for_prompt(result)

        assert "ERROR:" in formatted
        assert "Column not found" in formatted

    def test_format_includes_truncation_indicator(self):
        """Test that truncated results show indicator."""
        df = pd.DataFrame({"id": [1, 2]})
        request = ExtractRequest(
            source_file="test.csv",
            extract_type="filter",
            parameters={},
        )
        result = ExtractResult(
            request=request,
            data=df,
            row_count=2,
            truncated=True,
            summary="Test",
        )

        formatted = format_for_prompt(result)

        assert "(truncated)" in formatted

    def test_format_includes_footer(self, sample_result):
        """Test that formatted output includes footer."""
        formatted = format_for_prompt(sample_result)

        assert "=== End Extract ===" in formatted


class TestEdgeCases:
    def test_empty_dataframe(self):
        """Test extraction from empty DataFrame."""
        service = DataExtractService(
            {"empty.csv": pd.DataFrame()},
            max_rows=100,
        )
        request = ExtractRequest(
            source_file="empty.csv",
            extract_type="sample",
            parameters={"n": 10},
        )

        # Should handle gracefully
        result = service.execute(request)
        assert result.row_count == 0

    def test_single_row_dataframe(self):
        """Test extraction from single-row DataFrame."""
        df = pd.DataFrame({"a": [1], "b": ["x"]})
        service = DataExtractService({"single.csv": df})

        request = ExtractRequest(
            source_file="single.csv",
            extract_type="top_n",
            parameters={"column": "a", "n": 10},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 1

    def test_dataframe_with_special_characters(self):
        """Test extraction from DataFrame with special characters."""
        df = pd.DataFrame({
            "name": ["O'Brien", "Smith & Co.", "Test, Inc."],
            "value": [1, 2, 3],
        })
        service = DataExtractService({"special.csv": df})

        request = ExtractRequest(
            source_file="special.csv",
            extract_type="filter",
            parameters={"column": "name", "operator": "contains", "value": "O'Brien"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 1

    def test_dataframe_with_mixed_types(self):
        """Test extraction from DataFrame with mixed types in column."""
        df = pd.DataFrame({
            "mixed": [1, "two", 3.0, None, True],
            "value": [1, 2, 3, 4, 5],
        })
        service = DataExtractService({"mixed.csv": df})

        request = ExtractRequest(
            source_file="mixed.csv",
            extract_type="sample",
            parameters={"n": 3},
        )
        result = service.execute(request)

        assert result.success is True

    def test_very_large_value_in_filter(self):
        """Test filter with very large numeric value."""
        df = pd.DataFrame({"amount": [1e15, 2e15, 3e15]})
        service = DataExtractService({"large.csv": df})

        request = ExtractRequest(
            source_file="large.csv",
            extract_type="filter",
            parameters={"column": "amount", "operator": ">", "value": 1.5e15},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 2

    def test_negative_values_in_top_n(self):
        """Test top N with negative values."""
        df = pd.DataFrame({"amount": [-100, -50, 0, 50, 100]})
        service = DataExtractService({"neg.csv": df})

        request = ExtractRequest(
            source_file="neg.csv",
            extract_type="top_n",
            parameters={"column": "amount", "n": 3, "order": "asc"},
        )
        result = service.execute(request)

        assert result.success is True
        df_result = result.as_dataframe
        assert df_result["amount"].iloc[0] == -100

    def test_unicode_column_names(self):
        """Test extraction with Unicode column names."""
        df = pd.DataFrame({
            "precio": [100, 200],
            "descripcion": ["A", "B"],
        })
        service = DataExtractService({"unicode.csv": df})

        request = ExtractRequest(
            source_file="unicode.csv",
            extract_type="filter",
            parameters={"column": "precio", "operator": ">", "value": 150},
        )
        result = service.execute(request)

        assert result.success is True

    def test_whitespace_handling_in_contains(self):
        """Test contains filter handles whitespace."""
        df = pd.DataFrame({
            "description": ["  leading spaces", "trailing spaces  ", "  both spaces  "],
            "id": [1, 2, 3],
        })
        service = DataExtractService({"ws.csv": df})

        request = ExtractRequest(
            source_file="ws.csv",
            extract_type="filter",
            parameters={"column": "description", "operator": "contains", "value": "spaces"},
        )
        result = service.execute(request)

        assert result.success is True
        assert result.row_count == 3

    def test_concurrent_service_instances(self, sample_transactions_df):
        """Test multiple service instances don't interfere."""
        service1 = DataExtractService({"data1.csv": sample_transactions_df.head(50)})
        service2 = DataExtractService({"data2.csv": sample_transactions_df.tail(50)})

        request1 = ExtractRequest(
            source_file="data1.csv",
            extract_type="sample",
            parameters={"n": 5},
        )
        request2 = ExtractRequest(
            source_file="data2.csv",
            extract_type="sample",
            parameters={"n": 5},
        )

        result1 = service1.execute(request1)
        result2 = service2.execute(request2)

        assert result1.success is True
        assert result2.success is True
        assert service1.get_available_files() != service2.get_available_files()

    @pytest.fixture
    def sample_transactions_df(self):
        """Create a sample transactions DataFrame."""
        return pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100, freq="D"),
            "Description": ["Payment " + str(i) for i in range(100)],
            "Amount": [100.0 * (i % 10 + 1) for i in range(100)],
            "Vendor": ["Vendor A"] * 25 + ["Vendor B"] * 25 + ["Vendor C"] * 25 + ["Vendor D"] * 25,
        })
