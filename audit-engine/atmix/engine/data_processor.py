"""Data processor that executes LLM-defined processing strategies.

This module takes the DataPrepPlan from the LLM and executes it,
creating derived files that are right-sized for analysis.
"""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from rich.console import Console

from ..prompts.data_prep import DataPrepPlan, FileProfile, ProcessingStrategy
from .data_engineer import DataEngineerAgent

console = Console()


class DataProcessor:
    """Executes data processing strategies defined by the LLM."""

    # Hard limits on output file sizes to avoid token overflow in analysis
    MAX_OUTPUT_ROWS = 300  # Max rows per derived file
    MAX_EXTRACT_ROWS = 100  # Max rows per extract type (before combining)

    def __init__(self, workspace: Path):
        """Initialize the data processor.

        Args:
            workspace: Path to the workspace directory
        """
        self.workspace = workspace
        self.input_path = workspace / "input"
        self.cleaned_path = workspace / "cleaned"
        self.derived_path = workspace / "derived"

    def profile_file(self, file_path: Path, sample_rows: int = 30) -> FileProfile:
        """Create a profile of a data file for LLM review.

        Args:
            file_path: Path to the data file (CSV or Excel)
            sample_rows: Number of rows to include in sample

        Returns:
            FileProfile with schema, stats, and sample
        """
        # Use appropriate reader based on file extension
        if file_path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        # Basic info
        profile = FileProfile(
            filename=file_path.name,
            row_count=len(df),
            column_count=len(df.columns),
            columns=list(df.columns),
            sample_data=df.head(sample_rows).to_csv(index=False),
            file_size_bytes=file_path.stat().st_size,
        )

        # Detect column types
        for col in df.columns:
            # Check if date column
            if df[col].dtype == "object":
                try:
                    pd.to_datetime(df[col].head(100), errors="raise")
                    profile.date_columns.append(col)
                except (ValueError, TypeError):
                    pass

            # Check if numeric
            if pd.api.types.is_numeric_dtype(df[col]):
                profile.numeric_columns.append(col)
            elif col not in profile.date_columns:
                profile.categorical_columns.append(col)

        # Get unique counts for categorical columns (limit to avoid huge output)
        for col in profile.categorical_columns[:5]:
            try:
                profile.unique_counts[col] = df[col].nunique()
            except Exception:
                pass

        # Get date range if date columns exist
        if profile.date_columns:
            date_col = profile.date_columns[0]
            try:
                dates = pd.to_datetime(df[date_col], errors="coerce")
                min_date = dates.min()
                max_date = dates.max()
                if pd.notna(min_date) and pd.notna(max_date):
                    profile.date_range = f"{min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}"
            except Exception:
                pass

        return profile

    def execute_plan(self, plan: DataPrepPlan) -> Dict[str, Path]:
        """Execute a data preparation plan.

        Args:
            plan: The DataPrepPlan to execute

        Returns:
            Dict mapping output filenames to their paths
        """
        self.derived_path.mkdir(parents=True, exist_ok=True)
        outputs = {}

        for strategy in plan.strategies:
            try:
                result_path = self._execute_strategy(strategy)
                if result_path:
                    outputs[result_path.name] = result_path
                    console.print(f"  [green]✓[/green] Created {result_path.name}")
            except Exception as e:
                console.print(f"  [red]✗[/red] Failed to process {strategy.filename}: {e}")

        return outputs

    def _execute_strategy(self, strategy: ProcessingStrategy) -> Optional[Path]:
        """Execute a single processing strategy.

        Args:
            strategy: The strategy to execute

        Returns:
            Path to the output file, or None if failed
        """
        # Find the source file
        source_path = self._find_file(strategy.filename)
        if not source_path:
            console.print(f"  [yellow]⚠[/yellow] Source file not found: {strategy.filename}")
            return None

        # Use appropriate reader based on file extension
        if source_path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(source_path)
        else:
            df = pd.read_csv(source_path)

        # Apply filters first (if any)
        if strategy.filters:
            df = self._apply_filters(df, strategy.filters)

        # Execute based on strategy type
        if strategy.strategy_type == "aggregate":
            result_df = self._execute_aggregate(df, strategy)
        elif strategy.strategy_type == "filter":
            result_df = df  # Filters already applied
        elif strategy.strategy_type == "sample":
            result_df = self._execute_sample(df, strategy)
        elif strategy.strategy_type == "extract":
            return self._execute_extract(df, strategy)
        elif strategy.strategy_type == "custom":
            return self._execute_custom(strategy)
        elif strategy.strategy_type == "use_as_is":
            result_df = df
        else:
            console.print(f"  [yellow]⚠[/yellow] Unknown strategy type: {strategy.strategy_type}")
            return None

        # Save output
        output_name = strategy.output_filename or f"{strategy.filename.replace('.csv', '')}_processed.csv"
        output_path = self.derived_path / output_name
        result_df.to_csv(output_path, index=False)

        return output_path

    def _execute_aggregate(self, df: pd.DataFrame, strategy: ProcessingStrategy) -> pd.DataFrame:
        """Execute an aggregation strategy.

        Args:
            df: Source DataFrame
            strategy: The aggregation strategy

        Returns:
            Aggregated DataFrame
        """
        if not strategy.group_by:
            console.print("  [yellow]⚠[/yellow] No group_by columns specified for aggregation")
            return df

        # Ensure group_by columns exist
        valid_group_by = [col for col in strategy.group_by if col in df.columns]

        # Handle Month grouping specially - extract from date columns
        if "Month" in strategy.group_by and "Month" not in df.columns:
            # Try to find a date column
            for col in df.columns:
                try:
                    df["Month"] = pd.to_datetime(df[col], errors="coerce").dt.to_period("M").astype(str)
                    valid_group_by.append("Month")
                    break
                except Exception:
                    continue

        if not valid_group_by:
            console.print("  [yellow]⚠[/yellow] No valid group_by columns found")
            return df

        # Build aggregation dict
        agg_dict = {}
        for output_col, agg_expr in strategy.aggregations.items():
            col, func = self._parse_aggregation(agg_expr, df)
            if col and func:
                agg_dict[col] = func

        if not agg_dict:
            # Default aggregation - sum numeric columns
            for col in df.select_dtypes(include=["number"]).columns:
                if col not in valid_group_by:
                    agg_dict[col] = "sum"

        try:
            result = df.groupby(valid_group_by, as_index=False).agg(agg_dict)
            # Enforce row limit - keep most recent/largest
            if len(result) > self.MAX_OUTPUT_ROWS:
                console.print(f"    Limiting aggregated output from {len(result)} to {self.MAX_OUTPUT_ROWS} rows")
                # Sort by first numeric column descending to keep largest values
                numeric_cols = result.select_dtypes(include=["number"]).columns
                if len(numeric_cols) > 0:
                    result = result.nlargest(self.MAX_OUTPUT_ROWS, numeric_cols[0])
                else:
                    result = result.head(self.MAX_OUTPUT_ROWS)
            return result
        except Exception as e:
            console.print(f"  [yellow]⚠[/yellow] Aggregation error: {e}")
            return df

    def _execute_sample(self, df: pd.DataFrame, strategy: ProcessingStrategy) -> pd.DataFrame:
        """Execute a sampling strategy.

        Args:
            df: Source DataFrame
            strategy: The sampling strategy

        Returns:
            Sampled DataFrame
        """
        n = strategy.sample_size or 500

        if strategy.sample_method == "recent":
            # Try to find a date column and sort by it
            for col in df.columns:
                try:
                    df["_sort_date"] = pd.to_datetime(df[col], errors="coerce")
                    df = df.sort_values("_sort_date", ascending=False).drop(columns=["_sort_date"])
                    break
                except Exception:
                    continue
            return df.head(n)

        elif strategy.sample_method == "random":
            return df.sample(n=min(n, len(df)), random_state=42)

        elif strategy.sample_method == "stratified":
            # Simple stratified: take proportional sample from each category
            # Find first categorical column with reasonable cardinality
            for col in df.columns:
                if df[col].dtype == "object" and 2 <= df[col].nunique() <= 20:
                    try:
                        return df.groupby(col, group_keys=False).apply(
                            lambda x: x.sample(n=min(len(x), max(1, n // df[col].nunique())), random_state=42)
                        )
                    except Exception:
                        pass
            return df.sample(n=min(n, len(df)), random_state=42)

        return df.head(n)

    def _execute_extract(self, df: pd.DataFrame, strategy: ProcessingStrategy) -> Optional[Path]:
        """Execute an extraction strategy (multiple outputs).

        Args:
            df: Source DataFrame
            strategy: The extraction strategy

        Returns:
            Path to the combined output file
        """
        all_extracts = []

        for extract_name, condition in strategy.extract_conditions.items():
            try:
                mask = self._parse_condition(df, condition)
                extracted = df[mask].copy()
                # Limit rows per extract type
                if len(extracted) > self.MAX_EXTRACT_ROWS:
                    console.print(f"    Extracted '{extract_name}': {len(extracted)} rows (limiting to {self.MAX_EXTRACT_ROWS})")
                    # Sort by amount/value columns to keep most significant
                    numeric_cols = extracted.select_dtypes(include=["number"]).columns
                    if len(numeric_cols) > 0:
                        # Use absolute value to catch both debits and credits
                        extracted = extracted.reindex(
                            extracted[numeric_cols[0]].abs().nlargest(self.MAX_EXTRACT_ROWS).index
                        )
                    else:
                        extracted = extracted.head(self.MAX_EXTRACT_ROWS)
                else:
                    console.print(f"    Extracted '{extract_name}': {len(extracted)} rows")
                extracted["_extract_type"] = extract_name
                all_extracts.append(extracted)
            except Exception as e:
                console.print(f"    [yellow]⚠[/yellow] Extract '{extract_name}' failed: {e}")

        if not all_extracts:
            return None

        # Combine all extracts
        combined = pd.concat(all_extracts, ignore_index=True)

        output_name = strategy.output_filename or f"{strategy.filename.replace('.csv', '')}_extracts.csv"
        output_path = self.derived_path / output_name
        combined.to_csv(output_path, index=False)

        return output_path

    def _execute_custom(self, strategy: ProcessingStrategy) -> Optional[Path]:
        """Execute a custom data engineering task via DataEngineerAgent.

        The agent will write and execute Python code to accomplish the task.

        Args:
            strategy: The custom processing strategy with task_description

        Returns:
            Path to the output file, or None if failed
        """
        if not strategy.task_description:
            console.print("  [yellow]⚠[/yellow] No task_description for custom strategy")
            return None

        # Gather source files - primary file plus any additional sources
        source_files = [strategy.filename]
        if strategy.source_files:
            source_files.extend(strategy.source_files)

        # Determine output filename
        output_filename = strategy.output_filename
        if not output_filename:
            # Generate from task description
            base = strategy.filename.replace('.csv', '').replace('.xlsx', '').replace('.xls', '')
            output_filename = f"{base}_custom.csv"

        console.print(f"  [cyan]🛠️[/cyan] Dispatching DataEngineerAgent...")
        console.print(f"     Task: {strategy.task_description[:80]}...")

        # Execute via DataEngineerAgent
        agent = DataEngineerAgent(self.workspace)
        result_path = agent.execute_task(
            task_description=strategy.task_description,
            source_files=source_files,
            output_filename=output_filename,
        )

        if result_path:
            console.print(f"  [green]✓[/green] Custom task complete: {result_path.name}")
        else:
            console.print(f"  [red]✗[/red] Custom task failed")

        return result_path

    def _apply_filters(self, df: pd.DataFrame, filters: List[str]) -> pd.DataFrame:
        """Apply filter conditions to a DataFrame.

        Args:
            df: Source DataFrame
            filters: List of filter conditions

        Returns:
            Filtered DataFrame
        """
        result = df.copy()

        for filter_expr in filters:
            try:
                mask = self._parse_condition(result, filter_expr)
                result = result[mask]
            except Exception as e:
                console.print(f"    [yellow]⚠[/yellow] Filter '{filter_expr}' failed: {e}")

        return result

    def _parse_condition(self, df: pd.DataFrame, condition: str) -> pd.Series:
        """Parse a condition string into a boolean mask.

        Supports: >, <, >=, <=, ==, !=, CONTAINS, AND, OR

        Args:
            df: DataFrame to apply condition to
            condition: Condition string

        Returns:
            Boolean Series mask
        """
        # Handle OR
        if " OR " in condition.upper():
            parts = re.split(r"\s+OR\s+", condition, flags=re.IGNORECASE)
            mask = pd.Series([False] * len(df))
            for part in parts:
                mask = mask | self._parse_condition(df, part.strip())
            return mask

        # Handle AND
        if " AND " in condition.upper():
            parts = re.split(r"\s+AND\s+", condition, flags=re.IGNORECASE)
            mask = pd.Series([True] * len(df))
            for part in parts:
                mask = mask & self._parse_condition(df, part.strip())
            return mask

        # Handle CONTAINS
        contains_match = re.match(r"(\w+)\s+CONTAINS\s+['\"](.+)['\"]", condition, re.IGNORECASE)
        if contains_match:
            col, value = contains_match.groups()
            if col in df.columns:
                return df[col].astype(str).str.contains(value, case=False, na=False)

        # Handle comparison operators
        for op, pd_op in [(">=", ">="), ("<=", "<="), ("!=", "!="), ("==", "=="), (">", ">"), ("<", "<")]:
            if op in condition:
                parts = condition.split(op)
                if len(parts) == 2:
                    col = parts[0].strip()
                    value = parts[1].strip().strip("'\"")

                    if col in df.columns:
                        try:
                            # Try numeric comparison
                            num_value = float(value)
                            return eval(f"df[col] {pd_op} num_value")
                        except ValueError:
                            # String comparison
                            return eval(f"df[col].astype(str) {pd_op} value")

        # Default: return all True (no filter)
        console.print(f"    [yellow]⚠[/yellow] Could not parse condition: {condition}")
        return pd.Series([True] * len(df))

    def _parse_aggregation(self, agg_expr: str, df: pd.DataFrame) -> Tuple[Optional[str], Optional[str]]:
        """Parse an aggregation expression like 'sum(Debit)'.

        Args:
            agg_expr: Aggregation expression string
            df: DataFrame to validate column names against

        Returns:
            Tuple of (column_name, aggregation_function)
        """
        # Match patterns like sum(col), count(), mean(col)
        match = re.match(r"(\w+)\((\w*)\)", agg_expr.strip())
        if match:
            func, col = match.groups()
            func = func.lower()

            if func == "count":
                # For count, use any column
                return (df.columns[0], "count")

            if col and col in df.columns:
                func_map = {
                    "sum": "sum",
                    "mean": "mean",
                    "avg": "mean",
                    "min": "min",
                    "max": "max",
                    "std": "std",
                    "count": "count",
                    "first": "first",
                    "last": "last",
                }
                if func in func_map:
                    return (col, func_map[func])

        return (None, None)

    def _find_file(self, filename: str) -> Optional[Path]:
        """Find a file in workspace.

        Args:
            filename: Filename to find

        Returns:
            Path to file or None
        """
        for search_path in [self.cleaned_path, self.input_path]:
            file_path = search_path / filename
            if file_path.exists():
                return file_path

            # Try case-insensitive match for CSV and Excel files
            if search_path.exists():
                for pattern in ["*.csv", "*.xlsx", "*.xls"]:
                    for f in search_path.glob(pattern):
                        if f.name.lower() == filename.lower():
                            return f

        return None


def profile_workspace_files(
    workspace: Path,
    large_threshold_rows: int = 500,
    large_threshold_chars: int = 50000,
    sample_rows: int = 30,
) -> Tuple[List[FileProfile], List[str]]:
    """Profile all CSV files in a workspace.

    Args:
        workspace: Path to the workspace
        large_threshold_rows: Files with more rows are "large"
        large_threshold_chars: Files with more chars are "large"
        sample_rows: Rows to include in sample

    Returns:
        Tuple of (large_file_profiles, small_file_names)
    """
    processor = DataProcessor(workspace)
    large_files = []
    small_files = []

    # Check cleaned first, then input
    for search_path in [workspace / "cleaned", workspace / "input"]:
        if not search_path.exists():
            continue

        # Profile both CSV and Excel files
        for pattern in ["*.csv", "*.xlsx", "*.xls"]:
            for file_path in search_path.glob(pattern):
                # Skip if we already processed this filename
                if file_path.name in [f.filename for f in large_files] + small_files:
                    continue

                try:
                    profile = processor.profile_file(file_path, sample_rows)

                    # Determine if large
                    sample_chars = len(profile.sample_data) * (profile.row_count / sample_rows)

                    if profile.row_count > large_threshold_rows or sample_chars > large_threshold_chars:
                        large_files.append(profile)
                    else:
                        small_files.append(file_path.name)

                except Exception as e:
                    console.print(f"  [yellow]⚠[/yellow] Could not profile {file_path.name}: {e}")
                    small_files.append(file_path.name)  # Treat errors as small files

    return large_files, small_files
