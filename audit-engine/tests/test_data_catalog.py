"""Tests for DataCatalog module."""

import pytest
from datetime import datetime
from io import StringIO

import pandas as pd
import numpy as np

from atmix.engine.data_catalog import (
    DataCatalog,
    CatalogResult,
    FileCatalog,
    NumericSummary,
    CategoricalSummary,
    DateRangeSummary,
    ColumnInfo,
    Anomaly,
    FINANCIAL_COLUMN_PATTERNS,
)


class TestColumnInfo:
    def test_create_column_info(self):
        ci = ColumnInfo(
            name="Amount",
            dtype="float64",
            null_count=5,
            null_percent=0.05,
            detected_type="amount",
            sample_values=["100.00", "250.50", "75.25"],
        )
        assert ci.name == "Amount"
        assert ci.detected_type == "amount"

    def test_serialization(self):
        ci = ColumnInfo(
            name="Date",
            dtype="object",
            null_count=0,
            null_percent=0.0,
            detected_type="date",
            sample_values=["2024-01-01", "2024-01-02"],
        )
        d = ci.to_dict()
        ci2 = ColumnInfo.from_dict(d)
        assert ci2.name == ci.name
        assert ci2.detected_type == ci.detected_type


class TestNumericSummary:
    def test_create_numeric_summary(self):
        ns = NumericSummary(
            column_name="Amount",
            count=100,
            null_count=5,
            min_value=-500.0,
            max_value=10000.0,
            sum_value=50000.0,
            mean_value=500.0,
            median_value=350.0,
            std_value=750.0,
            top_values=[(100.0, 10), (200.0, 8), (50.0, 5)],
            bottom_values=[(1.0, 1), (2.0, 1), (3.0, 1)],
            zero_count=3,
            negative_count=5,
            positive_count=92,
        )
        assert ns.column_name == "Amount"
        assert ns.sum_value == 50000.0

    def test_serialization(self):
        ns = NumericSummary(
            column_name="Debit",
            count=50,
            null_count=0,
            min_value=0.0,
            max_value=1000.0,
            sum_value=25000.0,
            mean_value=500.0,
            median_value=500.0,
            std_value=200.0,
            top_values=[(500.0, 5)],
            bottom_values=[(100.0, 2)],
            zero_count=0,
            negative_count=0,
            positive_count=50,
        )
        d = ns.to_dict()
        ns2 = NumericSummary.from_dict(d)
        assert ns2.column_name == ns.column_name
        assert ns2.sum_value == ns.sum_value
        assert ns2.top_values == ns.top_values


class TestCategoricalSummary:
    def test_create_categorical_summary(self):
        cs = CategoricalSummary(
            column_name="Vendor",
            count=100,
            null_count=2,
            unique_count=25,
            top_values=[("ACME Corp", 15), ("Global Inc", 12), ("Local LLC", 8)],
            sample_values=["ACME Corp", "Global Inc", "Local LLC"],
            avg_length=12.5,
            max_length=30,
            min_length=5,
        )
        assert cs.column_name == "Vendor"
        assert cs.unique_count == 25

    def test_serialization(self):
        cs = CategoricalSummary(
            column_name="Description",
            count=50,
            null_count=0,
            unique_count=45,
            top_values=[("Payment received", 5)],
            sample_values=["Payment received", "Invoice payment"],
            avg_length=20.0,
            max_length=100,
            min_length=10,
        )
        d = cs.to_dict()
        cs2 = CategoricalSummary.from_dict(d)
        assert cs2.column_name == cs.column_name
        assert cs2.top_values == cs.top_values


class TestDateRangeSummary:
    def test_create_date_range_summary(self):
        drs = DateRangeSummary(
            column_name="Transaction Date",
            min_date="2024-01-01",
            max_date="2024-12-31",
            span_days=365,
            null_count=0,
            count=1000,
            gaps=["2024-07-01 to 2024-08-01 (31 days)"],
        )
        assert drs.column_name == "Transaction Date"
        assert drs.span_days == 365

    def test_serialization(self):
        drs = DateRangeSummary(
            column_name="Date",
            min_date="2024-01-01",
            max_date="2024-06-30",
            span_days=181,
            null_count=2,
            count=179,
            gaps=[],
        )
        d = drs.to_dict()
        drs2 = DateRangeSummary.from_dict(d)
        assert drs2.min_date == drs.min_date
        assert drs2.max_date == drs.max_date


class TestAnomaly:
    def test_create_anomaly(self):
        a = Anomaly(
            anomaly_type="outlier",
            severity="high",
            column="Amount",
            description="15 outliers (3%) outside [-1000, 5000]",
            affected_rows=15,
            sample_values=[10000.0, -5000.0, 15000.0],
        )
        assert a.anomaly_type == "outlier"
        assert a.severity == "high"

    def test_serialization(self):
        a = Anomaly(
            anomaly_type="duplicate",
            severity="medium",
            column="(entire row)",
            description="50 duplicate rows (5%)",
            affected_rows=50,
            sample_values=[],
        )
        d = a.to_dict()
        a2 = Anomaly.from_dict(d)
        assert a2.anomaly_type == a.anomaly_type
        assert a2.affected_rows == a.affected_rows


class TestFileCatalog:
    def test_create_file_catalog(self):
        fc = FileCatalog(
            filename="transactions.csv",
            row_count=1000,
            column_count=8,
            file_size_bytes=50000,
            column_info=[],
            date_ranges=[],
            numeric_summaries=[],
            categorical_summaries=[],
            potential_anomalies=[],
            detected_file_type="transactions",
        )
        assert fc.filename == "transactions.csv"
        assert fc.detected_file_type == "transactions"

    def test_serialization(self):
        fc = FileCatalog(
            filename="gl_export.csv",
            row_count=5000,
            column_count=12,
            file_size_bytes=200000,
            column_info=[
                ColumnInfo(
                    name="Date",
                    dtype="object",
                    null_count=0,
                    null_percent=0.0,
                    detected_type="date",
                    sample_values=["2024-01-01"],
                ),
            ],
            date_ranges=[
                DateRangeSummary(
                    column_name="Date",
                    min_date="2024-01-01",
                    max_date="2024-12-31",
                    span_days=365,
                    null_count=0,
                    count=5000,
                    gaps=[],
                ),
            ],
            numeric_summaries=[],
            categorical_summaries=[],
            potential_anomalies=[],
            detected_file_type="general_ledger",
        )
        d = fc.to_dict()
        fc2 = FileCatalog.from_dict(d)
        assert fc2.filename == fc.filename
        assert len(fc2.column_info) == 1
        assert len(fc2.date_ranges) == 1

    def test_to_summary_text(self):
        fc = FileCatalog(
            filename="test.csv",
            row_count=100,
            column_count=5,
            file_size_bytes=5000,
            column_info=[],
            date_ranges=[
                DateRangeSummary(
                    column_name="Date",
                    min_date="2024-01-01",
                    max_date="2024-03-31",
                    span_days=90,
                    null_count=0,
                    count=100,
                    gaps=[],
                ),
            ],
            numeric_summaries=[],
            categorical_summaries=[],
            potential_anomalies=[],
            detected_file_type="transactions",
        )
        summary = fc.to_summary_text()
        assert "test.csv" in summary
        assert "100" in summary
        assert "2024-01-01" in summary


class TestCatalogResult:
    def test_create_catalog_result(self):
        cr = CatalogResult(
            file_catalogs={},
            overall_summary="No files cataloged.",
            total_rows=0,
            total_files=0,
            date_coverage=None,
        )
        assert cr.total_files == 0

    def test_to_prompt_context(self):
        fc = FileCatalog(
            filename="data.csv",
            row_count=50,
            column_count=3,
            file_size_bytes=2000,
            column_info=[],
            date_ranges=[],
            numeric_summaries=[],
            categorical_summaries=[],
            potential_anomalies=[],
            detected_file_type="transactions",
        )
        cr = CatalogResult(
            file_catalogs={"data.csv": fc},
            overall_summary="1 file cataloged.",
            total_rows=50,
            total_files=1,
            date_coverage=("2024-01-01", "2024-12-31"),
        )
        context = cr.to_prompt_context()
        assert "DATA CATALOG" in context
        assert "data.csv" in context
        assert "2024-01-01" in context


class TestDataCatalog:
    @pytest.fixture
    def sample_transactions_df(self):
        """Create a sample transactions DataFrame."""
        return pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100, freq="D"),
            "Description": ["Payment " + str(i) for i in range(100)],
            "Debit": [100.0 * (i % 10 + 1) for i in range(100)],
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

    def test_build_catalog_single_file(self, sample_transactions_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({"transactions.csv": sample_transactions_df})

        assert result.total_files == 1
        assert result.total_rows == 100
        assert "transactions.csv" in result.file_catalogs

        fc = result.file_catalogs["transactions.csv"]
        assert fc.row_count == 100
        assert fc.column_count == 6

    def test_build_catalog_multiple_files(self, sample_transactions_df, sample_gl_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({
            "transactions.csv": sample_transactions_df,
            "gl_export.csv": sample_gl_df,
        })

        assert result.total_files == 2
        assert result.total_rows == 150
        assert result.date_coverage is not None

    def test_column_type_detection(self, sample_transactions_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": sample_transactions_df})
        fc = result.file_catalogs["test.csv"]

        # Check column type detection
        col_types = {ci.name: ci.detected_type for ci in fc.column_info}
        assert col_types.get("Date") == "date"
        assert col_types.get("Debit") in ["amount", "numeric"]
        assert col_types.get("Description") in ["description", "text"]
        assert col_types.get("Account") in ["account", "text"]
        assert col_types.get("Vendor") in ["vendor", "text"]

    def test_numeric_summaries(self, sample_transactions_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": sample_transactions_df})
        fc = result.file_catalogs["test.csv"]

        # Find Debit summary
        debit_summary = next(
            (ns for ns in fc.numeric_summaries if ns.column_name == "Debit"),
            None,
        )
        assert debit_summary is not None
        assert debit_summary.count == 100
        assert debit_summary.min_value > 0
        assert debit_summary.sum_value > 0

    def test_categorical_summaries(self, sample_transactions_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": sample_transactions_df})
        fc = result.file_catalogs["test.csv"]

        # Find Vendor summary
        vendor_summary = next(
            (cs for cs in fc.categorical_summaries if cs.column_name == "Vendor"),
            None,
        )
        assert vendor_summary is not None
        assert vendor_summary.unique_count == 4
        assert len(vendor_summary.top_values) > 0

    def test_date_range_detection(self, sample_transactions_df):
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": sample_transactions_df})
        fc = result.file_catalogs["test.csv"]

        assert len(fc.date_ranges) > 0
        dr = fc.date_ranges[0]
        assert dr.min_date == "2024-01-01"
        assert dr.span_days >= 99  # 100 days of data

    def test_anomaly_detection_duplicates(self):
        """Test detection of duplicate rows."""
        df = pd.DataFrame({
            "Date": ["2024-01-01"] * 50,
            "Amount": [100.0] * 50,
            "Description": ["Same entry"] * 50,
        })
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": df})
        fc = result.file_catalogs["test.csv"]

        # Should detect duplicates
        dup_anomalies = [a for a in fc.potential_anomalies if a.anomaly_type == "duplicate"]
        assert len(dup_anomalies) > 0

    def test_anomaly_detection_high_nulls(self):
        """Test detection of high null rates."""
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100),
            "Amount": [100.0] * 50 + [None] * 50,
            "Description": ["Test"] * 100,
        })
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": df})
        fc = result.file_catalogs["test.csv"]

        # Should detect high nulls
        null_anomalies = [a for a in fc.potential_anomalies if a.anomaly_type == "missing"]
        assert len(null_anomalies) > 0

    def test_anomaly_detection_outliers(self):
        """Test detection of numeric outliers."""
        # Create data with realistic distribution plus extreme outliers
        np.random.seed(42)
        normal_values = list(np.random.normal(100.0, 20.0, 95))
        outlier_values = [100000.0, -50000.0, 200000.0, -100000.0, 500000.0]
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=100),
            "Amount": normal_values + outlier_values,
        })
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": df})
        fc = result.file_catalogs["test.csv"]

        # Should detect outliers
        outlier_anomalies = [a for a in fc.potential_anomalies if a.anomaly_type == "outlier"]
        assert len(outlier_anomalies) > 0

    def test_file_type_detection_gl(self, sample_gl_df):
        """Test detection of general ledger file type."""
        catalog = DataCatalog()
        result = catalog.build_catalog({"gl.csv": sample_gl_df})
        fc = result.file_catalogs["gl.csv"]

        # Should detect as general_ledger or transactions
        assert fc.detected_file_type in ["general_ledger", "transactions"]

    def test_file_type_detection_transactions(self, sample_transactions_df):
        """Test detection of transactions file type."""
        catalog = DataCatalog()
        result = catalog.build_catalog({"txn.csv": sample_transactions_df})
        fc = result.file_catalogs["txn.csv"]

        assert fc.detected_file_type in ["transactions", "general_ledger"]

    def test_to_prompt_context_output(self, sample_transactions_df):
        """Test that prompt context is well-formed."""
        catalog = DataCatalog()
        result = catalog.build_catalog({"transactions.csv": sample_transactions_df})
        context = result.to_prompt_context()

        # Should contain key sections
        assert "DATA CATALOG" in context
        assert "transactions.csv" in context
        assert "Total:" in context

    def test_empty_dataframe(self):
        """Test handling of empty DataFrame."""
        df = pd.DataFrame()
        catalog = DataCatalog()
        result = catalog.build_catalog({"empty.csv": df})

        assert result.total_files == 1
        fc = result.file_catalogs["empty.csv"]
        assert fc.row_count == 0
        assert fc.column_count == 0

    def test_dataframe_with_all_nulls(self):
        """Test handling of DataFrame with all null values."""
        df = pd.DataFrame({
            "Col1": [None] * 10,
            "Col2": [None] * 10,
        })
        catalog = DataCatalog()
        result = catalog.build_catalog({"nulls.csv": df})

        fc = result.file_catalogs["nulls.csv"]
        assert fc.row_count == 10
        # Should have anomalies for high null rates
        assert len(fc.potential_anomalies) > 0

    def test_serialization_round_trip(self, sample_transactions_df):
        """Test full serialization round trip."""
        catalog = DataCatalog()
        result = catalog.build_catalog({"test.csv": sample_transactions_df})

        # Serialize and deserialize
        d = result.to_dict()
        result2 = CatalogResult.from_dict(d)

        assert result2.total_files == result.total_files
        assert result2.total_rows == result.total_rows
        assert len(result2.file_catalogs) == len(result.file_catalogs)

        # Check nested structures
        fc = result2.file_catalogs["test.csv"]
        assert len(fc.column_info) > 0
        assert len(fc.numeric_summaries) > 0


class TestFinancialColumnPatterns:
    def test_date_patterns(self):
        """Test that common date column names are recognized."""
        assert "date" in FINANCIAL_COLUMN_PATTERNS["date"]
        assert "transaction_date" in FINANCIAL_COLUMN_PATTERNS["date"]
        assert "posting_date" in FINANCIAL_COLUMN_PATTERNS["date"]

    def test_amount_patterns(self):
        """Test that common amount column names are recognized."""
        assert "amount" in FINANCIAL_COLUMN_PATTERNS["amount"]
        assert "debit" in FINANCIAL_COLUMN_PATTERNS["amount"]
        assert "credit" in FINANCIAL_COLUMN_PATTERNS["amount"]

    def test_vendor_patterns(self):
        """Test that common vendor column names are recognized."""
        assert "vendor" in FINANCIAL_COLUMN_PATTERNS["vendor"]
        assert "supplier" in FINANCIAL_COLUMN_PATTERNS["vendor"]
