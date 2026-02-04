"""Data Extract Service - On-demand data extraction for LLM analysis.

This module provides a service that allows the LLM to request specific
subsets of data during analysis, enabling targeted exploration without
overwhelming context windows.

Features:
- Filter: Apply conditions to extract matching rows
- Top N: Get highest/lowest values by column
- Aggregate: Group and summarize data
- Sample: Random or stratified sampling
- Custom: Natural language queries parsed into operations

Example usage:
    service = DataExtractService({"transactions.csv": df})

    # Filter high-value transactions
    result = service.execute(ExtractRequest(
        source_file="transactions.csv",
        extract_type="filter",
        parameters={"column": "amount", "operator": ">", "value": 10000}
    ))

    # Get top 10 by amount
    result = service.execute(ExtractRequest(
        source_file="transactions.csv",
        extract_type="top_n",
        parameters={"column": "amount", "n": 10, "order": "desc"}
    ))

    # Natural language request
    request = service.parse_natural_request(
        "Show me transactions where vendor contains 'Amazon' over $5000"
    )
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd

logger = logging.getLogger(__name__)


class ExtractType(Enum):
    """Types of data extraction operations."""

    FILTER = "filter"
    TOP_N = "top_n"
    AGGREGATE = "aggregate"
    SAMPLE = "sample"
    CUSTOM = "custom"

    @classmethod
    def from_string(cls, value: str) -> "ExtractType":
        """Parse extract type from string, defaulting to CUSTOM for unknown values."""
        try:
            return cls(value.lower())
        except ValueError:
            logger.warning(f"Unknown extract type '{value}', defaulting to CUSTOM")
            return cls.CUSTOM


@dataclass
class ExtractRequest:
    """Request for data extraction.

    Attributes:
        source_file: Which file to extract from (filename key in data_files dict).
        extract_type: Type of extraction operation.
        parameters: Type-specific parameters for the extraction.
        request_id: Optional unique identifier for tracking.

    Parameter schemas by extract_type:
        filter:
            column: str - Column to filter on
            operator: str - Comparison operator (>, <, >=, <=, ==, !=, contains, in)
            value: Any - Value to compare against
            case_sensitive: bool - For string operations (default: False)

        top_n:
            column: str - Column to sort by
            n: int - Number of rows to return
            order: str - "asc" or "desc" (default: "desc")

        aggregate:
            group_by: List[str] - Columns to group by
            agg: Dict[str, str] - Column -> aggregation function mapping
                Supported: sum, mean, min, max, count, first, last, std

        sample:
            n: int - Number of rows to sample
            method: str - "random", "stratified", or "systematic" (default: "random")
            stratify_column: str - Column for stratified sampling
            seed: int - Random seed for reproducibility (default: 42)

        custom:
            query: str - Natural language query description
    """

    source_file: str
    extract_type: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    request_id: Optional[str] = None

    def __post_init__(self) -> None:
        """Generate request_id if not provided."""
        if self.request_id is None:
            hash_input = f"{self.source_file}:{self.extract_type}:{self.parameters}"
            self.request_id = hashlib.md5(hash_input.encode()).hexdigest()[:12]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "source_file": self.source_file,
            "extract_type": self.extract_type,
            "parameters": self.parameters,
            "request_id": self.request_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExtractRequest":
        """Create from dictionary."""
        return cls(
            source_file=data.get("source_file", ""),
            extract_type=data.get("extract_type", "custom"),
            parameters=data.get("parameters", {}),
            request_id=data.get("request_id"),
        )


@dataclass
class ExtractResult:
    """Result of a data extraction operation.

    Attributes:
        request: The original extraction request.
        data: Extracted data as DataFrame or CSV string.
        row_count: Number of rows in the result.
        truncated: Whether the result was truncated to max_rows.
        summary: Human-readable summary of the extraction.
        execution_time_ms: Time taken to execute the extraction.
        error: Error message if extraction failed.
    """

    request: ExtractRequest
    data: Union[pd.DataFrame, str]
    row_count: int
    truncated: bool
    summary: str
    execution_time_ms: float = 0.0
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        """Check if extraction was successful."""
        return self.error is None

    @property
    def as_dataframe(self) -> Optional[pd.DataFrame]:
        """Get data as DataFrame, parsing CSV if needed."""
        if isinstance(self.data, pd.DataFrame):
            return self.data
        if isinstance(self.data, str) and self.data:
            try:
                import io

                return pd.read_csv(io.StringIO(self.data))
            except Exception:
                return None
        return None

    @property
    def as_csv(self) -> str:
        """Get data as CSV string."""
        if isinstance(self.data, str):
            return self.data
        if isinstance(self.data, pd.DataFrame):
            return self.data.to_csv(index=False)
        return ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "request": self.request.to_dict(),
            "data_csv": self.as_csv,
            "row_count": self.row_count,
            "truncated": self.truncated,
            "summary": self.summary,
            "execution_time_ms": self.execution_time_ms,
            "error": self.error,
        }


class LRUCache(OrderedDict):
    """Simple LRU cache implementation."""

    def __init__(self, maxsize: int = 128):
        super().__init__()
        self.maxsize = maxsize

    def get(self, key: str) -> Optional[Any]:
        """Get item and move to end (most recently used)."""
        if key in self:
            self.move_to_end(key)
            return self[key]
        return None

    def put(self, key: str, value: Any) -> None:
        """Add item, evicting oldest if at capacity."""
        if key in self:
            self.move_to_end(key)
        self[key] = value
        while len(self) > self.maxsize:
            self.popitem(last=False)


class DataExtractService:
    """Service for on-demand data extraction during LLM analysis.

    Provides safe, efficient extraction of data subsets for LLM consumption.
    All extractions are bounded by max_rows to prevent context overflow.

    Thread Safety:
        This class is NOT thread-safe. Each thread should use its own instance.

    Attributes:
        data_files: Dict mapping filenames to DataFrames.
        max_rows: Maximum rows to return in any extraction (default: 200).
    """

    # Supported comparison operators for filter operations
    OPERATORS = {
        ">": lambda col, val: col > val,
        "<": lambda col, val: col < val,
        ">=": lambda col, val: col >= val,
        "<=": lambda col, val: col <= val,
        "==": lambda col, val: col == val,
        "!=": lambda col, val: col != val,
        "contains": lambda col, val: col.astype(str).str.contains(str(val), case=False, na=False),
        "in": lambda col, val: col.isin(val if isinstance(val, list) else [val]),
        "not_in": lambda col, val: ~col.isin(val if isinstance(val, list) else [val]),
        "is_null": lambda col, val: col.isna(),
        "not_null": lambda col, val: col.notna(),
    }

    # Supported aggregation functions
    AGG_FUNCTIONS = {
        "sum": "sum",
        "mean": "mean",
        "avg": "mean",
        "min": "min",
        "max": "max",
        "count": "count",
        "first": "first",
        "last": "last",
        "std": "std",
        "median": "median",
        "nunique": "nunique",
    }

    def __init__(
        self,
        data_files: Dict[str, pd.DataFrame],
        max_rows: int = 200,
        cache_size: int = 50,
    ):
        """Initialize the data extract service.

        Args:
            data_files: Dict mapping filenames to DataFrames.
            max_rows: Maximum rows to return in any extraction.
            cache_size: Number of recent extracts to cache.
        """
        self.data_files = data_files
        self.max_rows = max_rows
        self._cache = LRUCache(maxsize=cache_size)
        self._request_log: List[Dict[str, Any]] = []

    def execute(self, request: ExtractRequest) -> ExtractResult:
        """Execute a data extraction request.

        Args:
            request: The extraction request to execute.

        Returns:
            ExtractResult containing the extracted data or error.
        """
        start_time = datetime.now()

        # Check cache first
        cache_key = request.request_id
        cached = self._cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Cache hit for request {cache_key}")
            return cached

        # Validate source file exists
        if request.source_file not in self.data_files:
            return self._error_result(
                request,
                f"Source file '{request.source_file}' not found. "
                f"Available: {list(self.data_files.keys())}",
            )

        df = self.data_files[request.source_file]

        # Route to appropriate handler
        extract_type = ExtractType.from_string(request.extract_type)

        try:
            if extract_type == ExtractType.FILTER:
                result = self._execute_filter(df, request)
            elif extract_type == ExtractType.TOP_N:
                result = self._execute_top_n(df, request)
            elif extract_type == ExtractType.AGGREGATE:
                result = self._execute_aggregate(df, request)
            elif extract_type == ExtractType.SAMPLE:
                result = self._execute_sample(df, request)
            elif extract_type == ExtractType.CUSTOM:
                result = self._execute_custom(df, request)
            else:
                result = self._error_result(
                    request,
                    f"Unknown extract type: {request.extract_type}",
                )

        except Exception as e:
            logger.exception(f"Extraction failed: {e}")
            result = self._error_result(request, str(e))

        # Calculate execution time
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        result.execution_time_ms = execution_time

        # Cache successful results
        if result.success:
            self._cache.put(cache_key, result)

        # Log the request
        self._log_request(request, result)

        return result

    def _execute_filter(
        self,
        df: pd.DataFrame,
        request: ExtractRequest,
    ) -> ExtractResult:
        """Execute a filter extraction.

        Args:
            df: Source DataFrame.
            request: The filter request with parameters.

        Returns:
            ExtractResult with filtered data.
        """
        params = request.parameters
        column = params.get("column")
        operator = params.get("operator", "==")
        value = params.get("value")

        # Validate column exists
        if column and column not in df.columns:
            return self._error_result(
                request,
                f"Column '{column}' not found. Available: {list(df.columns)}",
            )

        # Get operator function
        op_func = self.OPERATORS.get(operator.lower() if operator else "==")
        if op_func is None:
            return self._error_result(
                request,
                f"Unknown operator '{operator}'. Supported: {list(self.OPERATORS.keys())}",
            )

        # Apply filter
        try:
            # Convert value to appropriate type for comparison
            if column:
                col_dtype = df[column].dtype
                if pd.api.types.is_numeric_dtype(col_dtype) and value is not None:
                    if operator not in ("contains", "in", "not_in", "is_null", "not_null"):
                        value = float(value)

            mask = op_func(df[column], value)
            result_df = df[mask].copy()

        except Exception as e:
            return self._error_result(request, f"Filter error: {e}")

        return self._finalize_result(request, result_df, f"Filtered {column} {operator} {value}")

    def _execute_top_n(
        self,
        df: pd.DataFrame,
        request: ExtractRequest,
    ) -> ExtractResult:
        """Execute a top N extraction.

        Args:
            df: Source DataFrame.
            request: The top_n request with parameters.

        Returns:
            ExtractResult with top N rows.
        """
        params = request.parameters
        column = params.get("column")
        n = min(params.get("n", 10), self.max_rows)
        order = params.get("order", "desc").lower()

        # Validate column exists
        if column and column not in df.columns:
            return self._error_result(
                request,
                f"Column '{column}' not found. Available: {list(df.columns)}",
            )

        # Validate column is sortable
        if column and not pd.api.types.is_numeric_dtype(df[column]):
            # Try to convert or use string sorting
            try:
                result_df = df.sort_values(
                    column, ascending=(order == "asc"), na_position="last"
                ).head(n)
            except Exception as e:
                return self._error_result(request, f"Cannot sort by '{column}': {e}")
        else:
            ascending = order == "asc"
            if order == "desc":
                result_df = df.nlargest(n, column)
            else:
                result_df = df.nsmallest(n, column)

        summary = f"Top {n} by {column} ({order}ending)"
        return self._finalize_result(request, result_df, summary)

    def _execute_aggregate(
        self,
        df: pd.DataFrame,
        request: ExtractRequest,
    ) -> ExtractResult:
        """Execute an aggregation extraction.

        Args:
            df: Source DataFrame.
            request: The aggregate request with parameters.

        Returns:
            ExtractResult with aggregated data.
        """
        params = request.parameters
        group_by = params.get("group_by", [])
        agg_spec = params.get("agg", {})

        # Ensure group_by is a list
        if isinstance(group_by, str):
            group_by = [group_by]

        # Validate group_by columns exist
        missing_cols = [col for col in group_by if col not in df.columns]
        if missing_cols:
            return self._error_result(
                request,
                f"Group by columns not found: {missing_cols}. Available: {list(df.columns)}",
            )

        # Build aggregation dict
        agg_dict = {}
        for col, func in agg_spec.items():
            if col not in df.columns:
                logger.warning(f"Aggregation column '{col}' not found, skipping")
                continue

            func_lower = func.lower() if isinstance(func, str) else func
            pandas_func = self.AGG_FUNCTIONS.get(func_lower)
            if pandas_func is None:
                logger.warning(f"Unknown aggregation function '{func}', skipping")
                continue

            agg_dict[col] = pandas_func

        # If no valid aggregations, default to count
        if not agg_dict and group_by:
            first_col = df.columns[0]
            agg_dict[first_col] = "count"

        try:
            if group_by:
                result_df = df.groupby(group_by, as_index=False).agg(agg_dict)
            else:
                # Aggregate entire DataFrame
                result_series = df.agg(agg_dict)
                result_df = pd.DataFrame([result_series])

        except Exception as e:
            return self._error_result(request, f"Aggregation error: {e}")

        summary = f"Aggregated by {group_by}: {agg_spec}"
        return self._finalize_result(request, result_df, summary)

    def _execute_sample(
        self,
        df: pd.DataFrame,
        request: ExtractRequest,
    ) -> ExtractResult:
        """Execute a sample extraction.

        Args:
            df: Source DataFrame.
            request: The sample request with parameters.

        Returns:
            ExtractResult with sampled data.
        """
        params = request.parameters
        n = min(params.get("n", 100), self.max_rows, len(df))
        method = params.get("method", "random").lower()
        seed = params.get("seed", 42)
        stratify_column = params.get("stratify_column")

        try:
            if method == "random":
                result_df = df.sample(n=n, random_state=seed)

            elif method == "stratified":
                if not stratify_column:
                    # Find a good column for stratification
                    for col in df.columns:
                        if df[col].dtype == "object" and 2 <= df[col].nunique() <= 20:
                            stratify_column = col
                            break

                if stratify_column and stratify_column in df.columns:
                    # Proportional stratified sample
                    result_df = df.groupby(stratify_column, group_keys=False).apply(
                        lambda x: x.sample(
                            n=min(len(x), max(1, n // df[stratify_column].nunique())),
                            random_state=seed,
                        ),
                        include_groups=False,
                    )
                    # Ensure we don't exceed n
                    if len(result_df) > n:
                        result_df = result_df.sample(n=n, random_state=seed)
                else:
                    result_df = df.sample(n=n, random_state=seed)

            elif method == "systematic":
                # Systematic sampling: every k-th row
                k = max(1, len(df) // n)
                indices = list(range(0, len(df), k))[:n]
                result_df = df.iloc[indices]

            else:
                result_df = df.sample(n=n, random_state=seed)

        except Exception as e:
            return self._error_result(request, f"Sampling error: {e}")

        summary = f"Sampled {n} rows using {method} method"
        if stratify_column:
            summary += f" stratified by {stratify_column}"

        return self._finalize_result(request, result_df, summary)

    def _execute_custom(
        self,
        df: pd.DataFrame,
        request: ExtractRequest,
    ) -> ExtractResult:
        """Execute a custom/natural language extraction.

        Attempts to parse the query parameter into structured operations.

        Args:
            df: Source DataFrame.
            request: The custom request with query parameter.

        Returns:
            ExtractResult with extracted data.
        """
        params = request.parameters
        query = params.get("query", "")

        if not query:
            return self._error_result(request, "No query provided for custom extraction")

        # Try to parse and execute the natural language query
        parsed = self._parse_query(query, df.columns.tolist())

        if parsed is None:
            return self._error_result(
                request,
                f"Could not parse query: '{query}'. Try a simpler format like "
                "'column > value' or 'top 10 by column'.",
            )

        # Execute the parsed request
        parsed_request = ExtractRequest(
            source_file=request.source_file,
            extract_type=parsed["type"],
            parameters=parsed["params"],
        )

        # Recursive call with parsed request
        result = self.execute(parsed_request)

        # Update summary to reflect original query
        if result.success:
            result.summary = f"Custom query: {query} -> {result.summary}"

        return result

    def _parse_query(
        self,
        query: str,
        available_columns: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Parse a natural language query into structured parameters.

        Args:
            query: Natural language query string.
            available_columns: List of available column names.

        Returns:
            Dict with 'type' and 'params' keys, or None if unparseable.
        """
        query_lower = query.lower().strip()

        # Pattern: "top N by column" or "largest N column"
        top_n_patterns = [
            r"(?:top|largest|highest|biggest)\s+(\d+)\s+(?:by|in)?\s*(\w+)",
            r"(\d+)\s+(?:top|largest|highest|biggest)\s+(?:by|in)?\s*(\w+)",
            r"(?:show|get)\s+(?:the\s+)?(?:top|largest|highest)\s+(\d+)\s+(\w+)",
        ]
        for pattern in top_n_patterns:
            match = re.search(pattern, query_lower)
            if match:
                n = int(match.group(1))
                col_hint = match.group(2)
                col = self._match_column(col_hint, available_columns)
                if col:
                    return {
                        "type": "top_n",
                        "params": {"column": col, "n": n, "order": "desc"},
                    }

        # Pattern: "bottom N by column" or "smallest N column"
        bottom_n_patterns = [
            r"(?:bottom|smallest|lowest)\s+(\d+)\s+(?:by|in)?\s*(\w+)",
            r"(\d+)\s+(?:bottom|smallest|lowest)\s+(?:by|in)?\s*(\w+)",
        ]
        for pattern in bottom_n_patterns:
            match = re.search(pattern, query_lower)
            if match:
                n = int(match.group(1))
                col_hint = match.group(2)
                col = self._match_column(col_hint, available_columns)
                if col:
                    return {
                        "type": "top_n",
                        "params": {"column": col, "n": n, "order": "asc"},
                    }

        # Pattern: "column > value", "column contains 'text'"
        filter_patterns = [
            r"(\w+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)",
            r"(\w+)\s+(?:contains?|like)\s+['\"]?([^'\"]+)['\"]?",
            r"(\w+)\s+(?:is\s+)?(?:greater|more|higher)\s+than\s+([\d.]+)",
            r"(\w+)\s+(?:is\s+)?(?:less|lower|smaller)\s+than\s+([\d.]+)",
            r"(\w+)\s+(?:over|above)\s+([\d.]+)",
            r"(\w+)\s+(?:under|below)\s+([\d.]+)",
        ]

        # Try comparison patterns
        for i, pattern in enumerate(filter_patterns):
            match = re.search(pattern, query_lower)
            if match:
                groups = match.groups()
                col_hint = groups[0]
                col = self._match_column(col_hint, available_columns)

                if col:
                    if i == 0:  # Direct operator
                        return {
                            "type": "filter",
                            "params": {
                                "column": col,
                                "operator": groups[1],
                                "value": groups[2],
                            },
                        }
                    elif i == 1:  # Contains
                        return {
                            "type": "filter",
                            "params": {
                                "column": col,
                                "operator": "contains",
                                "value": groups[1],
                            },
                        }
                    elif i in (2, 4):  # Greater than / over
                        return {
                            "type": "filter",
                            "params": {"column": col, "operator": ">", "value": groups[1]},
                        }
                    elif i in (3, 5):  # Less than / under
                        return {
                            "type": "filter",
                            "params": {"column": col, "operator": "<", "value": groups[1]},
                        }

        # Pattern: "sample N rows"
        sample_match = re.search(r"(?:sample|random)\s+(\d+)", query_lower)
        if sample_match:
            return {
                "type": "sample",
                "params": {"n": int(sample_match.group(1)), "method": "random"},
            }

        # Pattern: "group by X sum Y" or "aggregate by X"
        agg_match = re.search(
            r"(?:group|aggregate)\s+by\s+(\w+)(?:\s+(?:sum|total)\s+(\w+))?", query_lower
        )
        if agg_match:
            group_col = self._match_column(agg_match.group(1), available_columns)
            agg_col = (
                self._match_column(agg_match.group(2), available_columns)
                if agg_match.group(2)
                else None
            )
            if group_col:
                params = {"group_by": [group_col], "agg": {}}
                if agg_col:
                    params["agg"][agg_col] = "sum"
                return {"type": "aggregate", "params": params}

        return None

    def _match_column(
        self,
        hint: str,
        available_columns: List[str],
    ) -> Optional[str]:
        """Match a column hint to actual column names.

        Args:
            hint: Partial or full column name.
            available_columns: List of actual column names.

        Returns:
            Matched column name or None.
        """
        hint_lower = hint.lower()

        # Exact match
        for col in available_columns:
            if col.lower() == hint_lower:
                return col

        # Prefix match
        for col in available_columns:
            if col.lower().startswith(hint_lower):
                return col

        # Contains match
        for col in available_columns:
            if hint_lower in col.lower():
                return col

        return None

    def _finalize_result(
        self,
        request: ExtractRequest,
        result_df: pd.DataFrame,
        summary: str,
    ) -> ExtractResult:
        """Finalize an extraction result, applying row limit.

        Args:
            request: The original request.
            result_df: The extracted DataFrame.
            summary: Summary description.

        Returns:
            ExtractResult with bounded data.
        """
        original_count = len(result_df)
        truncated = original_count > self.max_rows

        if truncated:
            result_df = result_df.head(self.max_rows)
            summary += f" (truncated from {original_count} to {self.max_rows} rows)"

        return ExtractResult(
            request=request,
            data=result_df,
            row_count=len(result_df),
            truncated=truncated,
            summary=summary,
        )

    def _error_result(
        self,
        request: ExtractRequest,
        error_message: str,
    ) -> ExtractResult:
        """Create an error result.

        Args:
            request: The original request.
            error_message: Description of the error.

        Returns:
            ExtractResult with error set.
        """
        return ExtractResult(
            request=request,
            data="",
            row_count=0,
            truncated=False,
            summary="",
            error=error_message,
        )

    def _log_request(
        self,
        request: ExtractRequest,
        result: ExtractResult,
    ) -> None:
        """Log an extraction request for traceability.

        Args:
            request: The extraction request.
            result: The extraction result.
        """
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "request_id": request.request_id,
            "source_file": request.source_file,
            "extract_type": request.extract_type,
            "parameters": request.parameters,
            "row_count": result.row_count,
            "truncated": result.truncated,
            "success": result.success,
            "execution_time_ms": result.execution_time_ms,
            "error": result.error,
        }
        self._request_log.append(log_entry)
        logger.info(
            f"Extract {request.request_id}: {request.extract_type} on {request.source_file} "
            f"-> {result.row_count} rows ({result.execution_time_ms:.1f}ms)"
        )

    def get_request_log(self) -> List[Dict[str, Any]]:
        """Get the log of all extraction requests.

        Returns:
            List of log entries.
        """
        return list(self._request_log)

    def clear_cache(self) -> None:
        """Clear the extraction cache."""
        self._cache.clear()

    def get_available_files(self) -> List[str]:
        """Get list of available data files.

        Returns:
            List of file names that can be extracted from.
        """
        return list(self.data_files.keys())

    def get_file_schema(self, filename: str) -> Optional[Dict[str, Any]]:
        """Get schema information for a data file.

        Args:
            filename: Name of the file to get schema for.

        Returns:
            Dict with columns, dtypes, and row_count, or None if not found.
        """
        if filename not in self.data_files:
            return None

        df = self.data_files[filename]
        return {
            "filename": filename,
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "row_count": len(df),
        }


def parse_natural_request(text: str, available_files: List[str]) -> Optional[ExtractRequest]:
    """Parse a natural language text into an ExtractRequest.

    This is a convenience function for parsing LLM output into structured requests.

    Args:
        text: Natural language request text from LLM.
        available_files: List of available file names.

    Returns:
        ExtractRequest or None if unparseable.

    Examples:
        "Show me the top 10 transactions by amount from transactions.csv"
        "Filter bank_data.csv where amount > 10000"
        "Sample 50 rows from customers.xlsx"
    """
    text_lower = text.lower()

    # Try to identify the source file
    source_file = None
    for filename in available_files:
        if filename.lower() in text_lower:
            source_file = filename
            break

    if not source_file and available_files:
        # Default to first file if not specified
        source_file = available_files[0]

    if not source_file:
        return None

    # Create a custom request with the full text as query
    return ExtractRequest(
        source_file=source_file,
        extract_type="custom",
        parameters={"query": text},
    )


def format_for_prompt(result: ExtractResult, max_lines: int = 50) -> str:
    """Format an ExtractResult for inclusion in an LLM prompt.

    Args:
        result: The extraction result to format.
        max_lines: Maximum lines of data to include.

    Returns:
        Formatted string suitable for prompt inclusion.
    """
    lines = []

    # Header
    lines.append(f"=== Data Extract: {result.request.source_file} ===")
    lines.append(f"Type: {result.request.extract_type}")
    lines.append(f"Summary: {result.summary}")
    lines.append(f"Rows: {result.row_count}" + (" (truncated)" if result.truncated else ""))
    lines.append("")

    if result.error:
        lines.append(f"ERROR: {result.error}")
        return "\n".join(lines)

    # Data
    csv_data = result.as_csv
    csv_lines = csv_data.strip().split("\n")

    if len(csv_lines) > max_lines:
        lines.extend(csv_lines[:max_lines])
        lines.append(f"... ({len(csv_lines) - max_lines} more rows)")
    else:
        lines.extend(csv_lines)

    lines.append("")
    lines.append("=== End Extract ===")

    return "\n".join(lines)
