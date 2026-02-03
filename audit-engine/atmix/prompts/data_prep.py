"""LLM prompts for data preparation planning.

The LLM examines schema + samples of large files and decides
how Python should process them before analysis.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class FileProfile:
    """Profile of a data file for LLM review."""

    filename: str
    row_count: int
    column_count: int
    columns: List[str]
    sample_data: str  # First N rows as CSV text
    file_size_bytes: int

    # Basic stats
    date_columns: List[str] = field(default_factory=list)
    date_range: Optional[str] = None
    numeric_columns: List[str] = field(default_factory=list)
    categorical_columns: List[str] = field(default_factory=list)
    unique_counts: Dict[str, int] = field(default_factory=dict)  # column -> unique count

    def to_prompt_text(self) -> str:
        """Format for LLM prompt."""
        lines = [
            f"## {self.filename}",
            f"- Rows: {self.row_count:,}",
            f"- Columns ({self.column_count}): {', '.join(self.columns)}",
        ]

        if self.date_range:
            lines.append(f"- Date range: {self.date_range}")

        if self.unique_counts:
            unique_str = ", ".join(f"{k}: {v}" for k, v in list(self.unique_counts.items())[:5])
            lines.append(f"- Unique values: {unique_str}")

        lines.append(f"\n### Sample Data (first rows)\n```csv\n{self.sample_data}\n```")

        return "\n".join(lines)


@dataclass
class ProcessingStrategy:
    """LLM-defined strategy for processing a large file."""

    filename: str
    strategy_type: str  # aggregate, filter, sample, extract, custom, use_as_is

    # For aggregation
    group_by: List[str] = field(default_factory=list)
    aggregations: Dict[str, str] = field(default_factory=dict)  # output_col -> "sum(col)" etc.

    # For filtering
    filters: List[str] = field(default_factory=list)  # SQL-like conditions

    # For sampling
    sample_size: Optional[int] = None
    sample_method: str = "recent"  # recent, random, stratified

    # For extraction
    extract_conditions: Dict[str, str] = field(default_factory=dict)  # name -> condition

    # For custom (LLM-generated code via DataEngineerAgent)
    task_description: str = ""  # Natural language description of what to compute
    source_files: List[str] = field(default_factory=list)  # Additional source files if needed

    # Output
    output_filename: str = ""
    rationale: str = ""

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "strategy_type": self.strategy_type,
            "group_by": self.group_by,
            "aggregations": self.aggregations,
            "filters": self.filters,
            "sample_size": self.sample_size,
            "sample_method": self.sample_method,
            "extract_conditions": self.extract_conditions,
            "task_description": self.task_description,
            "source_files": self.source_files,
            "output_filename": self.output_filename,
            "rationale": self.rationale,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProcessingStrategy":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class DataPrepPlan:
    """Complete data preparation plan from LLM."""

    strategies: List[ProcessingStrategy]
    small_files: List[str]  # Files that don't need processing
    rationale: str

    def to_dict(self) -> dict:
        return {
            "strategies": [s.to_dict() for s in self.strategies],
            "small_files": self.small_files,
            "rationale": self.rationale,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DataPrepPlan":
        strategies = [ProcessingStrategy.from_dict(s) for s in data.get("strategies", [])]
        return cls(
            strategies=strategies,
            small_files=data.get("small_files", []),
            rationale=data.get("rationale", ""),
        )


class DataPrepPrompts:
    """Prompts for data preparation planning."""

    # Threshold for "large" files that need processing
    LARGE_FILE_ROWS = 500
    LARGE_FILE_CHARS = 50000

    @staticmethod
    def create_data_prep_prompt(
        large_files: List[FileProfile],
        small_files: List[str],
        business_context: Optional[str] = None,
    ) -> str:
        """Create prompt for data preparation planning.

        Args:
            large_files: Profiles of files that need processing decisions
            small_files: List of files small enough to use directly
            business_context: Optional context about the business

        Returns:
            The data preparation prompt
        """
        files_section = "\n\n".join(f.to_prompt_text() for f in large_files)
        small_section = "\n".join(f"- {f}" for f in small_files)

        context_section = ""
        if business_context:
            context_section = f"""
## Business Context
{business_context}
"""

        return f"""You are a senior data analyst preparing financial data for audit analysis.

Some data files are too large to analyze directly and need to be processed first.
Your job is to decide HOW each large file should be processed so the analysis can work with manageable, meaningful data.
{context_section}
## Small Files (ready to use as-is)
{small_section}

## Large Files (need processing strategy)

{files_section}

## Your Task

For each large file, decide the best processing strategy:

1. **aggregate**: Group and summarize data
   - Useful for: transaction logs, general ledgers, detailed sales data
   - Specify: group_by columns, aggregation functions

2. **filter**: Keep only relevant rows
   - Useful for: filtering to recent period, material amounts, specific categories
   - Specify: filter conditions

3. **sample**: Take a representative sample
   - Useful for: when patterns matter more than totals
   - Specify: sample size, method (recent/random/stratified)

4. **extract**: Create multiple targeted extracts
   - Useful for: anomaly detection, specific account analysis
   - Specify: extraction conditions for each output

5. **custom**: Request a custom data transformation
   - Useful for: derived analyses that predefined strategies can't handle
   - Examples: customer concentration analysis, revenue by segment, cohort analysis
   - Specify: task_description (what to compute), source_files (if multiple files needed)
   - A subagent will write custom Python code to accomplish the task

6. **use_as_is**: File is actually fine (e.g., summary data mislabeled as large)

## Output Format

Respond with a JSON object:

```json
{{
  "strategies": [
    {{
      "filename": "general_ledger.csv",
      "strategy_type": "aggregate",
      "group_by": ["Account", "Month"],
      "aggregations": {{
        "total_debit": "sum(Debit)",
        "total_credit": "sum(Credit)",
        "transaction_count": "count()"
      }},
      "filters": [],
      "output_filename": "gl_by_account_month.csv",
      "rationale": "GL has 15K rows of individual transactions. Aggregating by account and month will show patterns while reducing to ~1500 rows."
    }},
    {{
      "filename": "general_ledger.csv",
      "strategy_type": "extract",
      "extract_conditions": {{
        "large_transactions": "Debit > 5000 OR Credit > 5000",
        "adjustments": "Description CONTAINS 'adjust' OR Description CONTAINS 'correction'"
      }},
      "output_filename": "gl_anomalies.csv",
      "rationale": "Extract unusual transactions for detailed review - adjustments and large amounts often indicate issues."
    }}
  ],
  "small_files": ["pl.csv", "balance_sheet.csv"],
  "rationale": "The GL needs aggregation for trend analysis and extraction for anomaly review. Other files are already summary-level."
}}
```

## Guidelines

1. **Think about what analysis needs**: What questions will be asked of this data?
2. **Preserve analytical value**: Don't lose important signals when aggregating
3. **Multiple strategies per file OK**: You can aggregate AND extract from the same file
4. **Be specific with conditions**: Use actual column names from the sample
5. **Consider the business**: A retail GL needs different treatment than a service company's

IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON object."""

    @staticmethod
    def format_prep_plan_for_display(plan: DataPrepPlan) -> str:
        """Format data prep plan for user display.

        Args:
            plan: The DataPrepPlan to format

        Returns:
            Formatted string for terminal display
        """
        lines = [
            "=" * 60,
            "DATA PREPARATION PLAN",
            "=" * 60,
            "",
        ]

        if plan.small_files:
            lines.append(f"Files ready to use ({len(plan.small_files)}):")
            for f in plan.small_files:
                lines.append(f"  ✓ {f}")
            lines.append("")

        if plan.strategies:
            lines.append(f"Files to process ({len(plan.strategies)} operations):")
            lines.append("─" * 40)

            for s in plan.strategies:
                icon = {
                    "aggregate": "📊",
                    "filter": "🔍",
                    "sample": "📋",
                    "extract": "🎯",
                    "custom": "🛠️",
                    "use_as_is": "✓",
                }.get(s.strategy_type, "•")

                lines.append(f"\n{icon} {s.filename} → {s.output_filename}")
                lines.append(f"   Strategy: {s.strategy_type}")

                if s.group_by:
                    lines.append(f"   Group by: {', '.join(s.group_by)}")
                if s.aggregations:
                    aggs = ", ".join(f"{k}={v}" for k, v in s.aggregations.items())
                    lines.append(f"   Aggregations: {aggs}")
                if s.filters:
                    lines.append(f"   Filters: {', '.join(s.filters)}")
                if s.extract_conditions:
                    for name, cond in s.extract_conditions.items():
                        lines.append(f"   Extract '{name}': {cond}")
                if s.task_description:
                    lines.append(f"   Task: {s.task_description[:100]}...")
                if s.source_files:
                    lines.append(f"   Sources: {', '.join(s.source_files)}")

                lines.append(f"   Rationale: {s.rationale[:100]}...")

        lines.append("")
        lines.append(f"Overall: {plan.rationale}")
        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
