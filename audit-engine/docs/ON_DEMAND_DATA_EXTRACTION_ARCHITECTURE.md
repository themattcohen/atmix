# On-Demand Data Extraction Architecture

## Design Document: Handling Large Financial Datasets in ATMIX Audit Engine

**Version:** 1.0
**Date:** 2026-02-03
**Status:** Proposed Architecture

---

## 1. Current State Analysis

### 1.1 Existing Architecture

The ATMIX audit engine currently handles large datasets through a **pre-processing approach** in Phase 1.5 (Data Preparation):

```
                     CURRENT DATA FLOW

+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Large CSV/XLSX  | --> |  DataProcessor    | --> |  Derived Files   |
|  (e.g., GL with  |     |  (one-time prep)  |     |  (aggregated/    |
|   15K rows)      |     |                   |     |   filtered)      |
|                  |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
                                |
                                v
                     +-----------------------+
                     |                       |
                     |  LLM Analysis Phase   |
                     |  (sees only derived   |
                     |   data, max 500 rows) |
                     |                       |
                     +-----------------------+
```

### 1.2 Current Limitations

**Token Budget Constraints:**
- `MAX_OUTPUT_ROWS = 300` per derived file
- `MAX_EXTRACT_ROWS = 100` per extract type
- `MAX_TOTAL_DATA_CHARS = 100000` (~25K tokens) for analysis prompts

**Static Pre-Processing Problems:**

1. **One-Shot Decision Making**: The LLM decides data prep strategy once at the start, before knowing what questions might arise during analysis.

2. **Loss of Detail**: Aggregation loses transaction-level detail that may be needed for specific investigations (e.g., "show me all payments to vendor XYZ").

3. **No Iterative Refinement**: If analysis reveals an area needing deeper investigation, the LLM cannot request additional data extracts.

4. **Truncation for Token Limits**: Large datasets are truncated to fit token limits, meaning the LLM never sees the full population.

### 1.3 Current Components

**DataProcessor** (`/Users/matt/Documents/atmix/audit-engine/atmix/engine/data_processor.py`):
- Profiles files to identify large ones (>500 rows or >50K chars)
- Executes LLM-defined processing strategies
- Supports: aggregate, filter, sample, extract, custom, use_as_is
- Creates derived files in `workspace/derived/`

**DataEngineerAgent** (`/Users/matt/Documents/atmix/audit-engine/atmix/engine/data_engineer.py`):
- LLM-powered agent that writes custom Python code
- Takes task description and source files
- Generates and executes transformation code
- Currently only invoked during pre-processing via "custom" strategy

**LLMOrchestrator** (`/Users/matt/Documents/atmix/audit-engine/atmix/engine/llm_orchestrator.py`):
- Main workflow controller
- Manages phases: Ingestion -> Context -> DataPrep -> Planning -> Analysis -> Synthesis
- Enforces token limits by truncating data in analysis prompts

---

## 2. Proposed Architecture: On-Demand Data Extraction

### 2.1 Core Concept

Replace the static pre-processing model with a **metadata-driven, on-demand extraction** system:

1. **Planning Phase** sees **statistical summaries** of all data (never the raw data)
2. **Analysis Phase** can **request specific extracts** via the DataEngineerAgent
3. **DataEngineerAgent** prepares **right-sized extracts** within token limits
4. **LLM can iteratively drill down** into areas of interest

```
                PROPOSED ON-DEMAND DATA FLOW

+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Large CSV/XLSX  | --> |  DataCatalog      | --> |  Full Population |
|  (e.g., GL with  |     |  (metadata +      |     |  Statistics      |
|   15K rows)      |     |   statistics)     |     |  for Planning    |
|                  |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
                                |
                                v
                     +-----------------------+
                     |                       |
                     |  LLM Planning Phase   |
                     |  (sees summaries,     |
                     |   understands full    |
                     |   population)         |
                     |                       |
                     +-----------------------+
                                |
                                v
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Analysis LLM    | <-- |  DataEngineerAgent| <-- |  On-Demand       |
|  (requests:      |     |  (prepares        |     |  Extract         |
|   "top 10        |     |   targeted        |     |  Request         |
|    vendors")     |     |   extracts)       |     |                  |
|                  |     |                   |     |                  |
+------------------+     +-------------------+     +------------------+
        |
        v
+--------------------------------------------------+
|  Iterative Loop: Analysis -> Request -> Extract  |
+--------------------------------------------------+
```

### 2.2 Key Components

#### 2.2.1 DataCatalog (New Component)

A metadata repository that provides the LLM with statistical understanding of all data without loading full datasets into context.

```python
@dataclass
class ColumnStatistics:
    """Statistics for a single column."""
    name: str
    dtype: str  # "numeric", "categorical", "date", "text"

    # For all types
    null_count: int
    null_percentage: float
    unique_count: int

    # For numeric columns
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    mean_value: Optional[float] = None
    median_value: Optional[float] = None
    sum_total: Optional[float] = None
    std_dev: Optional[float] = None

    # For categorical columns
    top_values: Optional[List[Tuple[str, int]]] = None  # (value, count)
    value_distribution: Optional[Dict[str, int]] = None

    # For date columns
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    date_range_days: Optional[int] = None
    records_by_month: Optional[Dict[str, int]] = None


@dataclass
class DatasetCatalogEntry:
    """Full catalog entry for a dataset."""
    filename: str
    file_path: Path

    # Basic metadata
    row_count: int
    column_count: int
    file_size_bytes: int

    # Column information
    columns: List[ColumnStatistics]

    # High-level summaries
    date_range: Optional[str] = None
    total_monetary_value: Optional[float] = None  # Sum of primary amount column
    key_dimensions: Dict[str, int] = field(default_factory=dict)  # dimension -> unique count

    # Sample data (small, for schema understanding)
    sample_rows: str = ""  # First 5 rows as CSV

    # Computed aggregates available
    available_aggregations: List[str] = field(default_factory=list)
```

#### 2.2.2 DataExtractRequest (New Component)

A structured way for the LLM to request specific data extracts.

```python
@dataclass
class DataExtractRequest:
    """Request for a specific data extract from the LLM."""

    request_id: str
    source_file: str
    request_type: str  # "filter", "aggregate", "top_n", "sample", "custom"

    # For filtering
    filter_conditions: Optional[List[str]] = None  # SQL-like conditions

    # For aggregation
    group_by: Optional[List[str]] = None
    aggregations: Optional[Dict[str, str]] = None

    # For top_n
    ranking_column: Optional[str] = None
    ranking_order: str = "desc"  # "asc" or "desc"
    top_n: Optional[int] = None

    # For custom
    task_description: Optional[str] = None

    # Output control
    max_rows: int = 100  # Enforce token-safe limits
    columns_to_include: Optional[List[str]] = None  # Subset of columns

    # Context
    analysis_context: str = ""  # Why this extract is needed

    def estimate_output_size(self) -> int:
        """Estimate output rows for token budgeting."""
        if self.top_n:
            return min(self.top_n, self.max_rows)
        return self.max_rows
```

#### 2.2.3 Enhanced DataEngineerAgent

Extend the existing DataEngineerAgent to support on-demand extract requests.

```python
class DataEngineerAgent:
    """Enhanced agent supporting on-demand data extraction."""

    # Existing functionality preserved...

    def execute_extract_request(
        self,
        request: DataExtractRequest,
        catalog: DatasetCatalogEntry,
    ) -> ExtractResult:
        """Execute an on-demand extract request.

        Args:
            request: The extract request from the LLM
            catalog: Catalog entry for the source dataset

        Returns:
            ExtractResult with data and metadata
        """
        pass

    def validate_request(
        self,
        request: DataExtractRequest,
        catalog: DatasetCatalogEntry,
    ) -> Tuple[bool, List[str]]:
        """Validate an extract request against catalog.

        Checks:
        - Column names exist
        - Filter conditions are valid
        - Output size is within limits
        - Request is achievable
        """
        pass

    def estimate_token_cost(
        self,
        request: DataExtractRequest,
        catalog: DatasetCatalogEntry,
    ) -> int:
        """Estimate token cost of the result.

        Uses catalog statistics to estimate output size.
        """
        pass
```

#### 2.2.4 AnalysisExecutor with Data Requests (Enhanced)

Modify the analysis phase to support iterative data requests.

```python
class AnalysisExecutor:
    """Executes analyses with on-demand data extraction."""

    def execute_analysis_with_data_requests(
        self,
        analysis: PlannedAnalysis,
        catalog: Dict[str, DatasetCatalogEntry],
        token_budget: int,
    ) -> AnalysisResult:
        """Execute an analysis allowing data requests.

        The analysis loop:
        1. Provide LLM with catalog summaries
        2. LLM requests specific extracts
        3. DataEngineerAgent prepares extracts
        4. LLM analyzes extracts
        5. LLM can request additional extracts
        6. Continue until LLM is satisfied or budget exhausted
        """
        pass
```

---

## 3. Data Flow Diagram

```
+============================================================================+
|                        ON-DEMAND DATA EXTRACTION FLOW                       |
+============================================================================+

PHASE 0: CATALOG BUILDING (One-time, during ingestion)
+--------------------------------------------------------------------------+
|                                                                           |
|  +------------+     +---------------+     +---------------------------+   |
|  |            |     |               |     |                           |   |
|  | Raw Files  | --> | DataCatalog   | --> | Catalog with Statistics   |   |
|  | (CSV/XLSX) |     | Builder       |     | (no raw data in context)  |   |
|  |            |     |               |     |                           |   |
|  +------------+     +---------------+     +---------------------------+   |
|                                                   |                       |
|                                                   v                       |
|                                           +---------------+               |
|                                           | catalog.json  |               |
|                                           | (persistent)  |               |
|                                           +---------------+               |
+--------------------------------------------------------------------------+

PHASE 2: PLANNING (Sees summaries, not raw data)
+--------------------------------------------------------------------------+
|                                                                           |
|  +---------------------------+     +-----------------------------------+  |
|  |                           |     |                                   |  |
|  | Catalog Summaries         | --> | Planning LLM                      |  |
|  | - Row counts              |     | - Understands full population     |  |
|  | - Date ranges             |     | - Plans analyses with awareness   |  |
|  | - Unique vendor count     |     |   of what extracts are possible   |  |
|  | - Total amounts           |     | - Specifies extract requirements  |  |
|  | - Top categories          |     |                                   |  |
|  |                           |     |                                   |  |
|  +---------------------------+     +-----------------------------------+  |
|                                                   |                       |
|                                                   v                       |
|                                           +-------------------+           |
|                                           | Analysis Plan     |           |
|                                           | with data         |           |
|                                           | requirements      |           |
|                                           +-------------------+           |
+--------------------------------------------------------------------------+

PHASE 3: ANALYSIS (Iterative extract loop)
+--------------------------------------------------------------------------+
|                                                                           |
|                          +------------------+                             |
|                          | Analysis LLM     |                             |
|                          | (has catalog     |                             |
|                          |  summaries)      |                             |
|                          +--------+---------+                             |
|                                   |                                       |
|            +----------------------+------------------------+              |
|            |                      |                        |              |
|            v                      v                        v              |
|  +-----------------+    +-----------------+    +-------------------+      |
|  | Extract Request |    | Extract Request |    | Extract Request   |      |
|  | "Top 10 vendors |    | "Transactions   |    | "Monthly revenue  |      |
|  |  by spend"      |    |  >$10K"         |    |  by category"     |      |
|  +-----------------+    +-----------------+    +-------------------+      |
|            |                      |                        |              |
|            +----------------------+------------------------+              |
|                                   |                                       |
|                                   v                                       |
|                     +-------------------------+                           |
|                     |   DataEngineerAgent     |                           |
|                     |   - Validates request   |                           |
|                     |   - Executes extraction |                           |
|                     |   - Enforces row limits |                           |
|                     |   - Returns right-sized |                           |
|                     |     extract             |                           |
|                     +-------------------------+                           |
|                                   |                                       |
|                                   v                                       |
|                     +-------------------------+                           |
|                     |   Extract Results       |                           |
|                     |   (within token budget) |                           |
|                     +-------------------------+                           |
|                                   |                                       |
|                                   v                                       |
|                     +-------------------------+                           |
|                     |   Analysis LLM          |                           |
|                     |   - Analyzes extract    |                           |
|                     |   - May request more    |                           |
|                     |     specific extracts   |                           |
|                     |   - Generates findings  |                           |
|                     +-------------------------+                           |
|                                   |                                       |
|                                   v                                       |
|                    (Loop until analysis complete)                         |
+--------------------------------------------------------------------------+

PHASE 4.5: INVESTIGATION (Deep-dive extracts)
+--------------------------------------------------------------------------+
|                                                                           |
|  +-----------------------+         +----------------------------------+   |
|  | Investigation Need    |         | DataEngineerAgent                |   |
|  | "Verify all payments  |  -----> | - Custom SQL: WHERE vendor =     |   |
|  |  to Acme Corp"        |         |   'Acme Corp'                    |   |
|  +-----------------------+         | - Returns all matching rows      |   |
|                                    |   (if within limits)             |   |
|                                    +----------------------------------+   |
|                                                                           |
+--------------------------------------------------------------------------+
```

---

## 4. Key Components and Responsibilities

### 4.1 DataCatalogBuilder

**Location:** `/atmix/engine/data_catalog.py` (new file)

**Responsibilities:**
- Scan all data files during ingestion
- Compute comprehensive statistics for each column
- Generate aggregate summaries (totals, distributions)
- Persist catalog to JSON for reuse
- Provide catalog summaries formatted for LLM prompts

**Key Methods:**
```python
class DataCatalogBuilder:
    def build_catalog(self, workspace: Path) -> Dict[str, DatasetCatalogEntry]:
        """Build complete catalog for all data files."""
        pass

    def compute_column_statistics(self, df: pd.DataFrame, col: str) -> ColumnStatistics:
        """Compute statistics for a single column."""
        pass

    def generate_summary_for_planning(self, catalog: Dict[str, DatasetCatalogEntry]) -> str:
        """Generate LLM-friendly summary for planning phase."""
        pass

    def persist_catalog(self, catalog: Dict, path: Path):
        """Save catalog to JSON for reuse."""
        pass
```

### 4.2 DataExtractService

**Location:** `/atmix/engine/data_extract_service.py` (new file)

**Responsibilities:**
- Receive extract requests from LLM
- Validate requests against catalog
- Route to appropriate extraction method
- Enforce token/row limits
- Cache recent extracts for reuse

**Key Methods:**
```python
class DataExtractService:
    def process_request(
        self,
        request: DataExtractRequest,
        catalog: DatasetCatalogEntry,
    ) -> ExtractResult:
        """Process an extract request and return results."""
        pass

    def execute_filter(self, df: pd.DataFrame, conditions: List[str]) -> pd.DataFrame:
        """Execute filter conditions."""
        pass

    def execute_aggregation(
        self,
        df: pd.DataFrame,
        group_by: List[str],
        aggregations: Dict[str, str],
    ) -> pd.DataFrame:
        """Execute aggregation."""
        pass

    def execute_top_n(
        self,
        df: pd.DataFrame,
        ranking_col: str,
        n: int,
        order: str,
    ) -> pd.DataFrame:
        """Get top N records."""
        pass

    def enforce_limits(self, df: pd.DataFrame, max_rows: int) -> pd.DataFrame:
        """Enforce row limits for token safety."""
        pass
```

### 4.3 Enhanced LLMOrchestrator

**Location:** `/atmix/engine/llm_orchestrator.py` (modify existing)

**New Responsibilities:**
- Build and maintain data catalog
- Provide catalog summaries to planning phase
- Enable extract requests during analysis
- Manage token budget across extracts

**Key Changes:**
```python
class LLMOrchestrator:
    # New attributes
    data_catalog: Dict[str, DatasetCatalogEntry]
    extract_service: DataExtractService

    def _run_catalog_building_phase(self) -> Dict[str, DatasetCatalogEntry]:
        """Build data catalog during ingestion."""
        pass

    def _run_analysis_with_extracts(
        self,
        plan: AnalysisPlan,
        catalog: Dict[str, DatasetCatalogEntry],
    ) -> List[Dict[str, Any]]:
        """Run analysis phase with on-demand extract support."""
        pass
```

### 4.4 Analysis Prompt Enhancement

**Location:** `/atmix/prompts/analysis.py` (modify existing)

**Changes:**
- Add catalog summary to analysis prompts
- Define extract request format in prompt
- Include available extract operations in prompt

**New Prompt Section:**
```
## Available Data (Catalog Summary)

You have access to the following datasets. You can request specific extracts.

### general_ledger.csv
- Total rows: 15,234
- Date range: 2024-01-01 to 2024-12-31
- Total debits: $2,345,678.90
- Total credits: $2,345,678.90
- Unique accounts: 147
- Unique vendors: 89
- Top 5 vendors by spend: [Acme Corp: $123K, Beta Inc: $98K, ...]

### Available Extract Operations

To analyze specific data, you may request an extract:

```json
{
  "extract_request": {
    "source_file": "general_ledger.csv",
    "request_type": "filter",
    "filter_conditions": ["Amount > 10000"],
    "max_rows": 100,
    "analysis_context": "Identify large transactions for review"
  }
}
```
```

---

## 5. Implementation Approach

### 5.1 Phase 1: Catalog Infrastructure (Week 1)

**Tasks:**
1. Create `DataCatalogBuilder` class
2. Implement column statistics computation
3. Create catalog persistence/loading
4. Add catalog building to ingestion phase
5. Create catalog summary formatter for LLM

**Files to Create:**
- `/atmix/engine/data_catalog.py`
- `/atmix/models/catalog.py`

**Files to Modify:**
- `/atmix/engine/llm_orchestrator.py` (add catalog building phase)

### 5.2 Phase 2: Extract Request System (Week 2)

**Tasks:**
1. Define `DataExtractRequest` and `ExtractResult` models
2. Create `DataExtractService` class
3. Implement filter, aggregation, top_n operations
4. Add request validation against catalog
5. Implement row limits and token budgeting

**Files to Create:**
- `/atmix/engine/data_extract_service.py`
- `/atmix/models/extract_request.py`

**Files to Modify:**
- `/atmix/engine/data_engineer.py` (integrate with extract service)

### 5.3 Phase 3: Analysis Integration (Week 3)

**Tasks:**
1. Modify planning prompts to use catalog summaries
2. Modify analysis prompts to support extract requests
3. Implement extract request parsing from LLM output
4. Create analysis-extract loop
5. Add token budget management

**Files to Modify:**
- `/atmix/prompts/planning.py`
- `/atmix/prompts/analysis.py`
- `/atmix/engine/llm_orchestrator.py`

### 5.4 Phase 4: Investigation Integration (Week 4)

**Tasks:**
1. Enable extract requests during investigation phase
2. Add deep-dive extraction capability
3. Implement extract caching
4. Add extract history for audit trail
5. Performance optimization

**Files to Modify:**
- `/atmix/engine/investigation.py`
- `/atmix/engine/llm_orchestrator.py`

---

## 6. Example Interaction Flow

### 6.1 Planning Phase

**LLM Receives (Catalog Summary):**
```
## Data Catalog Summary

### transactions.csv (General Ledger)
- Rows: 15,234
- Date range: 2024-01-01 to 2024-12-31
- Columns: Date, Account, Description, Debit, Credit, Vendor, Category
- Total transactions: $4,691,357.80
- Unique accounts: 147
- Unique vendors: 89

Top 10 Vendors by Total Spend:
1. Acme Corp: $234,567.89 (412 transactions)
2. Beta Services: $189,234.56 (287 transactions)
3. Cloud Provider Inc: $156,789.12 (12 transactions)
...

Monthly Transaction Volume:
- Jan 2024: 1,234 transactions, $389,456.78
- Feb 2024: 1,156 transactions, $367,123.45
...

Account Categories:
- Revenue: 23 accounts, $2,345,678.90 credit
- Expenses: 89 accounts, $1,987,654.32 debit
- Assets: 35 accounts, various
```

**LLM Plans:**
```json
{
  "planned_analyses": [
    {
      "name": "Vendor Concentration Analysis",
      "extract_needs": [
        {
          "description": "Top 10 vendors with all their transactions",
          "estimated_rows": 600
        }
      ]
    },
    {
      "name": "Large Transaction Review",
      "extract_needs": [
        {
          "description": "All transactions over $10,000",
          "estimated_rows": 150
        }
      ]
    }
  ]
}
```

### 6.2 Analysis Phase

**LLM Requests Extract:**
```json
{
  "extract_request": {
    "source_file": "transactions.csv",
    "request_type": "top_n",
    "ranking_column": "Vendor",
    "aggregation": "sum(Debit + Credit)",
    "top_n": 10,
    "columns_to_include": ["Date", "Description", "Debit", "Credit", "Vendor"],
    "analysis_context": "Analyzing vendor concentration risk"
  }
}
```

**DataEngineerAgent Returns:**
```csv
Date,Description,Debit,Credit,Vendor
2024-03-15,Consulting Services,45000.00,,Acme Corp
2024-04-22,Equipment Purchase,38500.00,,Acme Corp
2024-05-10,Monthly Retainer,15000.00,,Acme Corp
...
(100 rows for top 10 vendors)
```

**LLM Analyzes, Requests Follow-up:**
```json
{
  "extract_request": {
    "source_file": "transactions.csv",
    "request_type": "filter",
    "filter_conditions": [
      "Vendor = 'Acme Corp'",
      "Debit > 25000"
    ],
    "columns_to_include": ["Date", "Description", "Debit", "Account"],
    "analysis_context": "Acme Corp shows 5% of total spend - investigating large payments"
  }
}
```

---

## 7. Benefits

### 7.1 Completeness
- LLM understands **full population** through statistics
- No data is "lost" to truncation
- Can request any subset of data on demand

### 7.2 Efficiency
- Only extract what's needed for current analysis
- Token budget used for relevant data only
- Catalog building is one-time cost

### 7.3 Iterative Analysis
- LLM can drill down into areas of interest
- Follow-up questions can drive additional extracts
- Investigation phase gets full access to specific records

### 7.4 Audit Trail
- All extract requests are logged
- Clear record of what data informed each finding
- Reproducible analysis path

---

## 8. Risks and Mitigations

### 8.1 Risk: Extract Loops
**Risk:** LLM requests too many extracts, exhausting token budget.

**Mitigation:**
- Hard limit on extracts per analysis (e.g., 5)
- Token budget tracking with early warning
- LLM instructed to be strategic about requests

### 8.2 Risk: Invalid Requests
**Risk:** LLM requests extracts with invalid column names or conditions.

**Mitigation:**
- Catalog-based validation before execution
- Clear error messages back to LLM
- Column name suggestions in prompts

### 8.3 Risk: Performance
**Risk:** Multiple extracts slow down analysis.

**Mitigation:**
- Extract caching (same request = cached result)
- Parallel extract execution where possible
- Lazy loading of source data

### 8.4 Risk: Complexity
**Risk:** System becomes harder to understand and debug.

**Mitigation:**
- Clear extract request/response logging
- Extract history in state files
- Gradual rollout (opt-in flag initially)

---

## 9. Success Metrics

1. **Data Coverage:** LLM considers 100% of transactions in planning (via statistics)
2. **Extract Efficiency:** Average extracts per analysis < 3
3. **Token Efficiency:** Data tokens reduced by 50% while maintaining analysis quality
4. **Finding Quality:** No decrease in finding accuracy with new system
5. **Investigation Depth:** Ability to drill down to individual transactions

---

## 10. Appendix: Example Catalog JSON Schema

```json
{
  "version": "1.0",
  "built_at": "2024-01-15T10:30:00Z",
  "datasets": {
    "general_ledger.csv": {
      "filename": "general_ledger.csv",
      "file_path": "/workspace/input/general_ledger.csv",
      "row_count": 15234,
      "column_count": 7,
      "file_size_bytes": 2345678,
      "columns": [
        {
          "name": "Date",
          "dtype": "date",
          "null_count": 0,
          "null_percentage": 0.0,
          "unique_count": 365,
          "min_date": "2024-01-01",
          "max_date": "2024-12-31",
          "date_range_days": 365,
          "records_by_month": {
            "2024-01": 1234,
            "2024-02": 1156
          }
        },
        {
          "name": "Debit",
          "dtype": "numeric",
          "null_count": 7234,
          "null_percentage": 47.5,
          "unique_count": 5678,
          "min_value": 0.01,
          "max_value": 125000.00,
          "mean_value": 456.78,
          "median_value": 234.56,
          "sum_total": 2345678.90,
          "std_dev": 1234.56
        },
        {
          "name": "Vendor",
          "dtype": "categorical",
          "null_count": 3456,
          "null_percentage": 22.7,
          "unique_count": 89,
          "top_values": [
            ["Acme Corp", 412],
            ["Beta Services", 287],
            ["Cloud Provider Inc", 12]
          ]
        }
      ],
      "date_range": "2024-01-01 to 2024-12-31",
      "total_monetary_value": 4691357.80,
      "key_dimensions": {
        "Account": 147,
        "Vendor": 89,
        "Category": 12
      },
      "sample_rows": "Date,Account,Description,Debit,Credit,Vendor,Category\n2024-01-02,Rent Expense,Monthly Rent,5000.00,,ABC Property,Overhead\n...",
      "available_aggregations": [
        "by_account_monthly",
        "by_vendor_total",
        "by_category_monthly"
      ]
    }
  }
}
```

---

## 11. Next Steps

1. **Review and Approve:** Get stakeholder sign-off on architecture
2. **Prototype Catalog Builder:** Build minimal catalog implementation
3. **Test with Sample Data:** Validate statistics accuracy
4. **Implement Extract Service:** Build core extraction capability
5. **Integrate with Analysis:** Modify prompts and orchestrator
6. **Performance Testing:** Ensure acceptable latency
7. **Documentation:** Update user guides and API docs

---

*Document prepared by Claude Opus 4.5 - System Architecture Analysis*
