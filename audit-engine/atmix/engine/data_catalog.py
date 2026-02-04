"""Data Catalog - Comprehensive statistics generator for financial data files.

This module generates statistical summaries from financial data files that enable
an LLM to understand the full dataset without loading all raw data into context.
The catalog provides token-efficient representations of data structure, distributions,
and potential anomalies.
"""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from rich.console import Console

console = Console()


# Common financial column name patterns for smart detection
FINANCIAL_COLUMN_PATTERNS = {
    "date": [
        "date", "txn_date", "transaction_date", "posting_date", "invoice_date",
        "payment_date", "due_date", "created_at", "created", "timestamp",
    ],
    "amount": [
        "amount", "debit", "credit", "total", "subtotal", "balance", "price",
        "cost", "value", "sum", "net", "gross", "payment", "revenue", "expense",
    ],
    "description": [
        "description", "desc", "memo", "name", "detail", "details", "narration",
        "particulars", "notes", "comment", "line_memo", "item",
    ],
    "account": [
        "account", "account_name", "account_number", "gl_account", "ledger",
        "account_code", "chart_of_accounts", "coa",
    ],
    "vendor": [
        "vendor", "supplier", "payee", "merchant", "company", "counterparty",
        "vendor_name", "supplier_name",
    ],
    "customer": [
        "customer", "client", "buyer", "customer_name", "client_name", "bill_to",
    ],
    "category": [
        "category", "type", "class", "department", "cost_center", "segment",
        "classification", "group",
    ],
    "reference": [
        "reference", "ref", "invoice_number", "invoice_no", "check_number",
        "transaction_id", "txn_id", "doc_number", "po_number",
    ],
}


@dataclass
class NumericSummary:
    """Statistical summary for a numeric column."""

    column_name: str
    count: int
    null_count: int
    min_value: float
    max_value: float
    sum_value: float
    mean_value: float
    median_value: float
    std_value: float
    top_values: List[Tuple[float, int]]  # (value, count) pairs
    bottom_values: List[Tuple[float, int]]  # (value, count) pairs
    zero_count: int
    negative_count: int
    positive_count: int

    def to_dict(self) -> dict:
        return {
            "column_name": self.column_name,
            "count": self.count,
            "null_count": self.null_count,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "sum_value": self.sum_value,
            "mean_value": self.mean_value,
            "median_value": self.median_value,
            "std_value": self.std_value,
            "top_values": self.top_values,
            "bottom_values": self.bottom_values,
            "zero_count": self.zero_count,
            "negative_count": self.negative_count,
            "positive_count": self.positive_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NumericSummary":
        data = data.copy()
        # Convert top_values and bottom_values back to tuples
        data["top_values"] = [tuple(v) for v in data.get("top_values", [])]
        data["bottom_values"] = [tuple(v) for v in data.get("bottom_values", [])]
        return cls(**data)


@dataclass
class CategoricalSummary:
    """Statistical summary for a categorical/text column."""

    column_name: str
    count: int
    null_count: int
    unique_count: int
    top_values: List[Tuple[str, int]]  # (value, count) pairs - top 10
    sample_values: List[str]  # Random sample of 5 unique values
    avg_length: float
    max_length: int
    min_length: int

    def to_dict(self) -> dict:
        return {
            "column_name": self.column_name,
            "count": self.count,
            "null_count": self.null_count,
            "unique_count": self.unique_count,
            "top_values": self.top_values,
            "sample_values": self.sample_values,
            "avg_length": self.avg_length,
            "max_length": self.max_length,
            "min_length": self.min_length,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CategoricalSummary":
        data = data.copy()
        data["top_values"] = [tuple(v) for v in data.get("top_values", [])]
        return cls(**data)


@dataclass
class DateRangeSummary:
    """Summary of date range for a date column."""

    column_name: str
    min_date: str
    max_date: str
    span_days: int
    null_count: int
    count: int
    gaps: List[str]  # Notable gaps in date sequence

    def to_dict(self) -> dict:
        return {
            "column_name": self.column_name,
            "min_date": self.min_date,
            "max_date": self.max_date,
            "span_days": self.span_days,
            "null_count": self.null_count,
            "count": self.count,
            "gaps": self.gaps,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DateRangeSummary":
        return cls(**data)


@dataclass
class ColumnInfo:
    """Information about a single column."""

    name: str
    dtype: str
    null_count: int
    null_percent: float
    detected_type: str  # date, amount, description, account, vendor, etc.
    sample_values: List[str]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "dtype": self.dtype,
            "null_count": self.null_count,
            "null_percent": self.null_percent,
            "detected_type": self.detected_type,
            "sample_values": self.sample_values,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ColumnInfo":
        return cls(**data)


@dataclass
class Anomaly:
    """A potential anomaly detected in the data."""

    anomaly_type: str  # outlier, gap, duplicate, missing, inconsistency
    severity: str  # high, medium, low
    column: str
    description: str
    affected_rows: int
    sample_values: List[Any]

    def to_dict(self) -> dict:
        return {
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "column": self.column,
            "description": self.description,
            "affected_rows": self.affected_rows,
            "sample_values": self.sample_values,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Anomaly":
        return cls(**data)


@dataclass
class FileCatalog:
    """Complete catalog for a single data file."""

    filename: str
    row_count: int
    column_count: int
    file_size_bytes: int
    column_info: List[ColumnInfo]
    date_ranges: List[DateRangeSummary]
    numeric_summaries: List[NumericSummary]
    categorical_summaries: List[CategoricalSummary]
    potential_anomalies: List[Anomaly]
    detected_file_type: str  # transactions, gl, ar, ap, pl, balance_sheet, etc.
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "file_size_bytes": self.file_size_bytes,
            "column_info": [c.to_dict() for c in self.column_info],
            "date_ranges": [d.to_dict() for d in self.date_ranges],
            "numeric_summaries": [n.to_dict() for n in self.numeric_summaries],
            "categorical_summaries": [c.to_dict() for c in self.categorical_summaries],
            "potential_anomalies": [a.to_dict() for a in self.potential_anomalies],
            "detected_file_type": self.detected_file_type,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FileCatalog":
        data = data.copy()
        data["column_info"] = [ColumnInfo.from_dict(c) for c in data.get("column_info", [])]
        data["date_ranges"] = [DateRangeSummary.from_dict(d) for d in data.get("date_ranges", [])]
        data["numeric_summaries"] = [NumericSummary.from_dict(n) for n in data.get("numeric_summaries", [])]
        data["categorical_summaries"] = [CategoricalSummary.from_dict(c) for c in data.get("categorical_summaries", [])]
        data["potential_anomalies"] = [Anomaly.from_dict(a) for a in data.get("potential_anomalies", [])]
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)

    def to_summary_text(self) -> str:
        """Generate a concise text summary for LLM context."""
        lines = [
            f"## {self.filename}",
            f"- Rows: {self.row_count:,} | Columns: {self.column_count} | Type: {self.detected_file_type}",
        ]

        # Date ranges
        if self.date_ranges:
            for dr in self.date_ranges:
                lines.append(f"- Date range ({dr.column_name}): {dr.min_date} to {dr.max_date} ({dr.span_days} days)")

        # Key numeric columns
        amount_cols = [ns for ns in self.numeric_summaries if ns.column_name.lower() in ["amount", "debit", "credit", "total", "balance"]]
        if amount_cols:
            for ns in amount_cols[:3]:
                lines.append(
                    f"- {ns.column_name}: sum=${ns.sum_value:,.2f}, range=${ns.min_value:,.2f} to ${ns.max_value:,.2f}"
                )

        # Key categorical columns
        for cs in self.categorical_summaries[:3]:
            top_3 = ", ".join([f"{v[0]}({v[1]})" for v in cs.top_values[:3]])
            lines.append(f"- {cs.column_name}: {cs.unique_count} unique, top: {top_3}")

        # Anomalies
        high_anomalies = [a for a in self.potential_anomalies if a.severity == "high"]
        if high_anomalies:
            lines.append(f"- ANOMALIES ({len(high_anomalies)} high severity):")
            for a in high_anomalies[:3]:
                lines.append(f"  - {a.anomaly_type}: {a.description}")

        return "\n".join(lines)


@dataclass
class CatalogResult:
    """Complete catalog result for all files."""

    file_catalogs: Dict[str, FileCatalog]
    overall_summary: str
    total_rows: int
    total_files: int
    date_coverage: Optional[Tuple[str, str]]  # overall min/max dates
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "file_catalogs": {k: v.to_dict() for k, v in self.file_catalogs.items()},
            "overall_summary": self.overall_summary,
            "total_rows": self.total_rows,
            "total_files": self.total_files,
            "date_coverage": self.date_coverage,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CatalogResult":
        data = data.copy()
        data["file_catalogs"] = {k: FileCatalog.from_dict(v) for k, v in data.get("file_catalogs", {}).items()}
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)

    def to_prompt_context(self) -> str:
        """Generate formatted string optimized for LLM prompts.

        This method creates a token-efficient representation of the entire
        dataset that enables the LLM to understand data structure, contents,
        and potential issues without seeing raw data.
        """
        lines = [
            "# DATA CATALOG",
            f"Generated: {self.created_at.strftime('%Y-%m-%d %H:%M')}",
            f"Total: {self.total_files} files, {self.total_rows:,} rows",
        ]

        if self.date_coverage:
            lines.append(f"Date coverage: {self.date_coverage[0]} to {self.date_coverage[1]}")

        lines.append("")
        lines.append(self.overall_summary)
        lines.append("")
        lines.append("---")
        lines.append("")

        # Add individual file summaries
        for filename, catalog in self.file_catalogs.items():
            lines.append(catalog.to_summary_text())
            lines.append("")

        return "\n".join(lines)


class DataCatalog:
    """Generates comprehensive statistics catalogs from financial data files.

    The catalog enables LLMs to understand dataset structure and content
    without loading raw data into the token context.
    """

    # Thresholds for anomaly detection
    OUTLIER_IQR_MULTIPLIER = 3.0
    DUPLICATE_THRESHOLD = 0.05  # Flag if >5% duplicates
    MISSING_THRESHOLD = 0.10  # Flag if >10% missing
    DATE_GAP_THRESHOLD_DAYS = 30  # Flag gaps > 30 days

    def __init__(self):
        """Initialize the DataCatalog."""
        pass

    def build_catalog(
        self,
        data_files: Dict[str, pd.DataFrame],
        file_sizes: Optional[Dict[str, int]] = None,
    ) -> CatalogResult:
        """Build comprehensive catalog from data files.

        Args:
            data_files: Dict mapping filename to DataFrame
            file_sizes: Optional dict mapping filename to file size in bytes

        Returns:
            CatalogResult with statistics for all files
        """
        file_catalogs: Dict[str, FileCatalog] = {}
        total_rows = 0
        all_dates: List[datetime] = []

        for filename, df in data_files.items():
            try:
                catalog = self._build_file_catalog(
                    filename=filename,
                    df=df,
                    file_size=file_sizes.get(filename, 0) if file_sizes else 0,
                )
                file_catalogs[filename] = catalog
                total_rows += catalog.row_count

                # Collect dates for overall coverage
                for dr in catalog.date_ranges:
                    try:
                        all_dates.append(datetime.strptime(dr.min_date, "%Y-%m-%d"))
                        all_dates.append(datetime.strptime(dr.max_date, "%Y-%m-%d"))
                    except (ValueError, TypeError):
                        pass

                console.print(f"  [green]Cataloged[/green] {filename}: {catalog.row_count:,} rows")

            except Exception as e:
                console.print(f"  [red]Failed to catalog {filename}[/red]: {e}")

        # Calculate overall date coverage
        date_coverage = None
        if all_dates:
            min_date = min(all_dates).strftime("%Y-%m-%d")
            max_date = max(all_dates).strftime("%Y-%m-%d")
            date_coverage = (min_date, max_date)

        # Generate overall summary
        overall_summary = self._generate_overall_summary(file_catalogs)

        return CatalogResult(
            file_catalogs=file_catalogs,
            overall_summary=overall_summary,
            total_rows=total_rows,
            total_files=len(file_catalogs),
            date_coverage=date_coverage,
        )

    def _build_file_catalog(
        self,
        filename: str,
        df: pd.DataFrame,
        file_size: int = 0,
    ) -> FileCatalog:
        """Build catalog for a single file.

        Args:
            filename: Name of the file
            df: DataFrame containing the data
            file_size: Size of the file in bytes

        Returns:
            FileCatalog with comprehensive statistics
        """
        # Basic info
        row_count = len(df)
        column_count = len(df.columns)

        # Analyze columns
        column_info: List[ColumnInfo] = []
        date_columns: List[str] = []
        numeric_columns: List[str] = []
        categorical_columns: List[str] = []

        for col in df.columns:
            col_info = self._analyze_column(df, col)
            column_info.append(col_info)

            # Categorize columns
            if col_info.detected_type == "date":
                date_columns.append(col)
            elif pd.api.types.is_numeric_dtype(df[col]):
                numeric_columns.append(col)
            else:
                categorical_columns.append(col)

        # Build summaries
        date_ranges = [self._build_date_summary(df, col) for col in date_columns]
        date_ranges = [dr for dr in date_ranges if dr is not None]

        numeric_summaries = [self._build_numeric_summary(df, col) for col in numeric_columns]
        numeric_summaries = [ns for ns in numeric_summaries if ns is not None]

        categorical_summaries = [self._build_categorical_summary(df, col) for col in categorical_columns]
        categorical_summaries = [cs for cs in categorical_summaries if cs is not None]

        # Detect anomalies
        anomalies = self._detect_anomalies(df, column_info)

        # Detect file type
        detected_type = self._detect_file_type(df, column_info)

        return FileCatalog(
            filename=filename,
            row_count=row_count,
            column_count=column_count,
            file_size_bytes=file_size,
            column_info=column_info,
            date_ranges=date_ranges,
            numeric_summaries=numeric_summaries,
            categorical_summaries=categorical_summaries,
            potential_anomalies=anomalies,
            detected_file_type=detected_type,
        )

    def _analyze_column(self, df: pd.DataFrame, col: str) -> ColumnInfo:
        """Analyze a single column and detect its type.

        Args:
            df: DataFrame containing the column
            col: Column name

        Returns:
            ColumnInfo with detected type and basic stats
        """
        series = df[col]
        null_count = series.isna().sum()
        null_percent = null_count / len(series) if len(series) > 0 else 0

        # Get sample values (non-null)
        non_null = series.dropna()
        if len(non_null) > 0:
            sample_values = [str(v)[:100] for v in non_null.head(5).tolist()]
        else:
            sample_values = []

        # Detect type
        detected_type = self._detect_column_type(col, series)

        return ColumnInfo(
            name=col,
            dtype=str(series.dtype),
            null_count=int(null_count),
            null_percent=round(null_percent, 4),
            detected_type=detected_type,
            sample_values=sample_values,
        )

    def _detect_column_type(self, col: str, series: pd.Series) -> str:
        """Detect the semantic type of a column.

        Args:
            col: Column name
            series: Column data

        Returns:
            Detected type string
        """
        col_lower = col.lower().replace("_", " ").replace("-", " ")

        # Check name patterns first
        for type_name, patterns in FINANCIAL_COLUMN_PATTERNS.items():
            for pattern in patterns:
                if pattern in col_lower or col_lower in pattern:
                    return type_name

        # Try to detect date columns by parsing
        if series.dtype == "object":
            try:
                sample = series.dropna().head(100)
                if len(sample) > 0:
                    pd.to_datetime(sample, errors="raise")
                    return "date"
            except (ValueError, TypeError):
                pass

        # Default categorization by dtype
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        elif series.dtype == "object":
            return "text"
        else:
            return "other"

    def _build_date_summary(self, df: pd.DataFrame, col: str) -> Optional[DateRangeSummary]:
        """Build summary for a date column.

        Args:
            df: DataFrame
            col: Column name

        Returns:
            DateRangeSummary or None if parsing fails
        """
        try:
            dates = pd.to_datetime(df[col], errors="coerce")
            valid_dates = dates.dropna()

            if len(valid_dates) == 0:
                return None

            min_date = valid_dates.min()
            max_date = valid_dates.max()
            span_days = (max_date - min_date).days

            # Detect gaps
            gaps = self._detect_date_gaps(valid_dates)

            return DateRangeSummary(
                column_name=col,
                min_date=min_date.strftime("%Y-%m-%d"),
                max_date=max_date.strftime("%Y-%m-%d"),
                span_days=span_days,
                null_count=int(dates.isna().sum()),
                count=len(valid_dates),
                gaps=gaps,
            )
        except Exception:
            return None

    def _detect_date_gaps(self, dates: pd.Series) -> List[str]:
        """Detect significant gaps in date sequence.

        Args:
            dates: Series of datetime values

        Returns:
            List of gap descriptions
        """
        gaps = []
        if len(dates) < 2:
            return gaps

        sorted_dates = dates.sort_values()
        diffs = sorted_dates.diff().dropna()

        # Find gaps larger than threshold
        large_gaps = diffs[diffs.dt.days > self.DATE_GAP_THRESHOLD_DAYS]

        for idx, gap in large_gaps.head(5).items():
            gap_start = sorted_dates[sorted_dates.index.get_loc(idx) - 1]
            gap_end = sorted_dates[idx]
            gaps.append(
                f"{gap_start.strftime('%Y-%m-%d')} to {gap_end.strftime('%Y-%m-%d')} ({gap.days} days)"
            )

        return gaps

    def _build_numeric_summary(self, df: pd.DataFrame, col: str) -> Optional[NumericSummary]:
        """Build summary for a numeric column.

        Args:
            df: DataFrame
            col: Column name

        Returns:
            NumericSummary or None if column has no valid data
        """
        try:
            series = pd.to_numeric(df[col], errors="coerce")
            valid = series.dropna()

            if len(valid) == 0:
                return None

            # Basic stats
            count = len(valid)
            null_count = int(series.isna().sum())
            min_val = float(valid.min())
            max_val = float(valid.max())
            sum_val = float(valid.sum())
            mean_val = float(valid.mean())
            median_val = float(valid.median())
            std_val = float(valid.std()) if len(valid) > 1 else 0.0

            # Value counts
            zero_count = int((valid == 0).sum())
            negative_count = int((valid < 0).sum())
            positive_count = int((valid > 0).sum())

            # Top and bottom values by frequency
            value_counts = valid.value_counts()
            top_values = [(float(v), int(c)) for v, c in value_counts.head(5).items()]
            bottom_values = [(float(v), int(c)) for v, c in value_counts.tail(5).items()]

            return NumericSummary(
                column_name=col,
                count=count,
                null_count=null_count,
                min_value=min_val,
                max_value=max_val,
                sum_value=sum_val,
                mean_value=mean_val,
                median_value=median_val,
                std_value=std_val,
                top_values=top_values,
                bottom_values=bottom_values,
                zero_count=zero_count,
                negative_count=negative_count,
                positive_count=positive_count,
            )
        except Exception:
            return None

    def _build_categorical_summary(self, df: pd.DataFrame, col: str) -> Optional[CategoricalSummary]:
        """Build summary for a categorical/text column.

        Args:
            df: DataFrame
            col: Column name

        Returns:
            CategoricalSummary or None if column has no valid data
        """
        try:
            series = df[col]
            non_null = series.dropna().astype(str)

            if len(non_null) == 0:
                return None

            count = len(non_null)
            null_count = int(series.isna().sum())
            unique_count = non_null.nunique()

            # Top values by frequency
            value_counts = non_null.value_counts()
            top_values = [(str(v)[:100], int(c)) for v, c in value_counts.head(10).items()]

            # Sample of unique values
            unique_vals = non_null.unique()
            sample_size = min(5, len(unique_vals))
            sample_values = [str(v)[:100] for v in unique_vals[:sample_size]]

            # Length stats
            lengths = non_null.str.len()
            avg_length = float(lengths.mean())
            max_length = int(lengths.max())
            min_length = int(lengths.min())

            return CategoricalSummary(
                column_name=col,
                count=count,
                null_count=null_count,
                unique_count=unique_count,
                top_values=top_values,
                sample_values=sample_values,
                avg_length=round(avg_length, 1),
                max_length=max_length,
                min_length=min_length,
            )
        except Exception:
            return None

    def _detect_anomalies(
        self,
        df: pd.DataFrame,
        column_info: List[ColumnInfo],
    ) -> List[Anomaly]:
        """Detect potential anomalies in the data.

        Args:
            df: DataFrame to analyze
            column_info: Column information list

        Returns:
            List of detected anomalies
        """
        anomalies: List[Anomaly] = []

        # Check for high null rates
        for ci in column_info:
            if ci.null_percent > self.MISSING_THRESHOLD:
                severity = "high" if ci.null_percent > 0.5 else "medium"
                anomalies.append(Anomaly(
                    anomaly_type="missing",
                    severity=severity,
                    column=ci.name,
                    description=f"{ci.null_percent:.1%} null values",
                    affected_rows=ci.null_count,
                    sample_values=[],
                ))

        # Check for duplicates (entire rows)
        duplicate_count = df.duplicated().sum()
        if duplicate_count > 0:
            dup_rate = duplicate_count / len(df)
            if dup_rate > self.DUPLICATE_THRESHOLD:
                anomalies.append(Anomaly(
                    anomaly_type="duplicate",
                    severity="high" if dup_rate > 0.2 else "medium",
                    column="(entire row)",
                    description=f"{duplicate_count:,} duplicate rows ({dup_rate:.1%})",
                    affected_rows=int(duplicate_count),
                    sample_values=[],
                ))

        # Check for outliers in numeric columns
        for col in df.select_dtypes(include=[np.number]).columns:
            outliers = self._detect_numeric_outliers(df, col)
            if outliers:
                anomalies.append(outliers)

        # Check for unexpected negative values in typically positive columns
        positive_patterns = ["amount", "total", "balance", "price", "cost", "revenue"]
        for col in df.columns:
            if any(p in col.lower() for p in positive_patterns):
                if pd.api.types.is_numeric_dtype(df[col]):
                    neg_count = (df[col] < 0).sum()
                    if neg_count > 0:
                        neg_values = df[df[col] < 0][col].head(5).tolist()
                        anomalies.append(Anomaly(
                            anomaly_type="inconsistency",
                            severity="medium",
                            column=col,
                            description=f"{neg_count:,} negative values in typically positive column",
                            affected_rows=int(neg_count),
                            sample_values=[float(v) for v in neg_values],
                        ))

        return anomalies

    def _detect_numeric_outliers(self, df: pd.DataFrame, col: str) -> Optional[Anomaly]:
        """Detect outliers in a numeric column using IQR method.

        Args:
            df: DataFrame
            col: Column name

        Returns:
            Anomaly if outliers detected, None otherwise
        """
        try:
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(series) < 10:
                return None

            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1

            if iqr == 0:
                return None

            lower_bound = q1 - self.OUTLIER_IQR_MULTIPLIER * iqr
            upper_bound = q3 + self.OUTLIER_IQR_MULTIPLIER * iqr

            outliers = series[(series < lower_bound) | (series > upper_bound)]
            if len(outliers) == 0:
                return None

            outlier_rate = len(outliers) / len(series)
            if outlier_rate < 0.01:  # Skip if less than 1%
                return None

            sample_outliers = [float(v) for v in outliers.head(5).tolist()]

            return Anomaly(
                anomaly_type="outlier",
                severity="medium" if outlier_rate < 0.05 else "high",
                column=col,
                description=f"{len(outliers):,} outliers ({outlier_rate:.1%}) outside [{lower_bound:.2f}, {upper_bound:.2f}]",
                affected_rows=len(outliers),
                sample_values=sample_outliers,
            )
        except Exception:
            return None

    def _detect_file_type(
        self,
        df: pd.DataFrame,
        column_info: List[ColumnInfo],
    ) -> str:
        """Detect the type of financial file based on columns and content.

        Args:
            df: DataFrame
            column_info: Column information list

        Returns:
            Detected file type string
        """
        col_types = {ci.detected_type for ci in column_info}
        col_names_lower = {ci.name.lower() for ci in column_info}

        # Check for specific file types based on column patterns
        if any("debit" in c or "credit" in c for c in col_names_lower):
            if any("account" in c for c in col_names_lower):
                return "general_ledger"
            return "transactions"

        if any("invoice" in c for c in col_names_lower):
            if any("customer" in c or "bill_to" in c for c in col_names_lower):
                return "ar_aging"
            if any("vendor" in c or "supplier" in c for c in col_names_lower):
                return "ap_aging"
            return "invoices"

        if any("revenue" in c or "income" in c for c in col_names_lower):
            if any("expense" in c or "cost" in c for c in col_names_lower):
                return "profit_loss"
            return "revenue"

        if any("asset" in c for c in col_names_lower) and any("liability" in c or "equity" in c for c in col_names_lower):
            return "balance_sheet"

        if any("bank" in c for c in col_names_lower):
            return "bank_transactions"

        if any("payroll" in c or "salary" in c or "wage" in c for c in col_names_lower):
            return "payroll"

        if "vendor" in col_types or any("vendor" in c for c in col_names_lower):
            return "vendor_data"

        if "customer" in col_types or any("customer" in c for c in col_names_lower):
            return "customer_data"

        # Default based on structure
        if "date" in col_types and "amount" in col_types:
            return "transactions"

        return "unknown"

    def _generate_overall_summary(self, file_catalogs: Dict[str, FileCatalog]) -> str:
        """Generate an overall summary across all files.

        Args:
            file_catalogs: Dict of filename to FileCatalog

        Returns:
            Summary text
        """
        if not file_catalogs:
            return "No files cataloged."

        lines = ["## DATASET OVERVIEW"]

        # File type distribution
        type_counts: Dict[str, int] = {}
        total_rows = 0
        total_anomalies = 0
        high_anomalies = 0

        for catalog in file_catalogs.values():
            type_counts[catalog.detected_file_type] = type_counts.get(catalog.detected_file_type, 0) + 1
            total_rows += catalog.row_count
            total_anomalies += len(catalog.potential_anomalies)
            high_anomalies += len([a for a in catalog.potential_anomalies if a.severity == "high"])

        lines.append(f"- Files by type: {type_counts}")
        lines.append(f"- Total rows: {total_rows:,}")
        lines.append(f"- Anomalies detected: {total_anomalies} ({high_anomalies} high severity)")

        # Key financial columns across files
        amount_columns = set()
        date_columns = set()
        for catalog in file_catalogs.values():
            for ci in catalog.column_info:
                if ci.detected_type == "amount":
                    amount_columns.add(f"{catalog.filename}:{ci.name}")
                elif ci.detected_type == "date":
                    date_columns.add(f"{catalog.filename}:{ci.name}")

        if amount_columns:
            lines.append(f"- Amount columns: {len(amount_columns)}")
        if date_columns:
            lines.append(f"- Date columns: {len(date_columns)}")

        return "\n".join(lines)


def build_catalog_from_workspace(
    workspace: Path,
    cleaned_first: bool = True,
) -> CatalogResult:
    """Convenience function to build catalog from a workspace directory.

    Args:
        workspace: Path to workspace directory
        cleaned_first: If True, prefer cleaned/ over input/ directory

    Returns:
        CatalogResult
    """
    catalog_builder = DataCatalog()
    data_files: Dict[str, pd.DataFrame] = {}
    file_sizes: Dict[str, int] = {}

    # Determine search paths
    search_paths = []
    if cleaned_first:
        search_paths = [workspace / "cleaned", workspace / "input"]
    else:
        search_paths = [workspace / "input", workspace / "cleaned"]

    seen_files = set()

    for search_path in search_paths:
        if not search_path.exists():
            continue

        for pattern in ["*.csv", "*.xlsx", "*.xls"]:
            for file_path in search_path.glob(pattern):
                if file_path.name in seen_files:
                    continue
                seen_files.add(file_path.name)

                try:
                    if file_path.suffix.lower() in [".xlsx", ".xls"]:
                        df = pd.read_excel(file_path)
                    else:
                        df = pd.read_csv(file_path)

                    data_files[file_path.name] = df
                    file_sizes[file_path.name] = file_path.stat().st_size

                except Exception as e:
                    console.print(f"  [yellow]Could not read {file_path.name}[/yellow]: {e}")

    return catalog_builder.build_catalog(data_files, file_sizes)
