# atmix v3: LLM-First Dynamic Architecture

## Core Principle

**Python handles I/O. LLM handles intelligence.**

The LLM is always in control. It can:
- Generate Python tools on-the-fly
- Use, modify, or ignore existing tools
- Research platforms via web search
- Ask users for clarification
- Decide what analyses to run

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         atmix v3 - LLM-FIRST ENGINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUTS                          LLM BRAIN                      OUTPUTS     │
│  ───────                         ─────────                      ───────     │
│                                                                              │
│  ┌──────────┐                 ┌─────────────┐                ┌──────────┐  │
│  │ Financial│                 │             │                │  Audit   │  │
│  │   Data   │────────────────▶│   Claude    │───────────────▶│  Report  │  │
│  └──────────┘                 │             │                └──────────┘  │
│                               │  - Observes │                               │
│  ┌──────────┐                 │  - Asks     │                ┌──────────┐  │
│  │  User    │◀───────────────▶│  - Research │───────────────▶│  Pricing │  │
│  │ Context  │                 │  - Generates│                │  Quote   │  │
│  └──────────┘                 │  - Executes │                └──────────┘  │
│                               │             │                               │
│  ┌──────────┐                 └──────┬──────┘                ┌──────────┐  │
│  │   Web    │                        │                       │Questions │  │
│  │ Research │◀───────────────────────┘                       │for Client│  │
│  └──────────┘                                                └──────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        TOOL LIBRARY (Optional)                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  │
│  │  │ Shopify     │ │ Amazon      │ │ Stripe      │ │ Generic     │    │  │
│  │  │ Payout      │ │ Settlement  │ │ Payout      │ │ CSV         │    │  │
│  │  │ Parser      │ │ Parser      │ │ Parser      │ │ Analyzer    │    │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │  │
│  │                                                                       │  │
│  │  LLM can: USE as-is | MODIFY for this case | IGNORE and write new   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Knowledge Sources

The LLM builds understanding from THREE sources:

### 1. Data Observation
```
LLM sees: "SHOPIFY PAYOUT" in bank transactions
LLM infers: "This client uses Shopify"
```

### 2. User Context
```
User says: "We sell courses on Teachable and get sponsors"
LLM knows: Content creator with course platform + sponsorship revenue
```

### 3. Web Research
```
LLM doesn't know: "What reports does Teachable provide?"
LLM searches: "Teachable accounting reports export"
LLM learns: "Teachable provides payment history, student reports, affiliate reports"
```

## Core Components

### 1. Dynamic Tool Generator

The LLM can write Python code when needed:

```python
class DynamicToolGenerator:
    """LLM generates and executes Python tools on-demand."""

    def generate_tool(
        self,
        task_description: str,
        input_data_schema: str,
        expected_output: str,
    ) -> str:
        """LLM writes Python code for a specific task."""
        prompt = f"""
        Write a Python function to accomplish this task:

        TASK: {task_description}

        INPUT: {input_data_schema}

        EXPECTED OUTPUT: {expected_output}

        Requirements:
        - Function should be self-contained
        - Handle edge cases gracefully
        - Return structured data (dict or dataclass)
        - Include docstring explaining what it does

        Return ONLY the Python code, no explanation.
        """
        return self.llm_call(prompt)

    def execute_tool(self, code: str, input_data: Any) -> Any:
        """Execute LLM-generated code via Bash."""
        # Write code to temp file
        # Execute via subprocess
        # Return results
        pass
```

### 2. Tool Library (Optional Utilities)

Tools the LLM has created before, saved for potential reuse:

```
/atmix/tools/
├── parsers/
│   ├── shopify_payout.py      # Parse Shopify payout CSV
│   ├── amazon_settlement.py   # Parse Amazon settlement report
│   └── stripe_payout.py       # Parse Stripe payout CSV
├── analyzers/
│   ├── fee_reconciliation.py  # Compare platform fees to recorded expenses
│   └── timing_analysis.py     # Identify revenue timing differences
└── registry.json              # Index of available tools with descriptions
```

**Registry format:**
```json
{
  "tools": [
    {
      "name": "shopify_payout_parser",
      "path": "parsers/shopify_payout.py",
      "description": "Parses Shopify Payments payout CSV, extracts gross sales, fees, refunds, and net deposits",
      "input": "Path to Shopify payout CSV",
      "output": "Dict with gross, fees, refunds, net by date",
      "created": "2024-01-15",
      "last_used": "2024-01-20",
      "success_rate": 0.95
    }
  ]
}
```

**LLM decides:**
- "I see a Shopify payout CSV. There's an existing parser - let me check if it fits..."
- "This CSV has a different format. I'll write a custom parser."
- "The existing parser is close but needs modification for this client's setup."

### 3. Research Engine

LLM can search the web when it needs information:

```python
class ResearchEngine:
    """LLM-driven research for platform knowledge."""

    def research_platform(self, platform: str, questions: List[str]) -> str:
        """Research a platform to answer specific questions."""

        # Generate search queries
        queries = self.llm_generate_queries(platform, questions)

        # Execute searches
        results = []
        for query in queries:
            results.append(self.web_search(query))

        # Synthesize findings
        synthesis = self.llm_synthesize(platform, questions, results)

        return synthesis

    def research_on_demand(self, question: str) -> str:
        """Answer a specific question via research."""
        # LLM decides if it needs to search
        # If yes, searches and synthesizes
        # If no, answers from knowledge
        pass
```

### 4. Investigation Engine

LLM asks questions and requests documents:

```python
class InvestigationEngine:
    """LLM-driven investigation with user interaction."""

    def analyze_and_investigate(
        self,
        findings: List[Dict],
        context: BusinessContext,
    ) -> InvestigationPlan:
        """LLM decides what needs investigation."""

        prompt = f"""
        Review these audit findings and the business context.

        FINDINGS:
        {findings}

        CONTEXT:
        - Business type: {context.business_type}
        - User told us: {context.clarifications}
        - Platforms detected: {context.platforms}

        Identify:
        1. Findings that need clarification from the user
        2. Documents that would help verify findings
        3. Additional analyses that would be valuable

        For each, explain WHY it would help.

        Output JSON:
        {{
          "questions_for_user": [
            {{"question": "...", "why": "...", "related_finding": "..."}}
          ],
          "document_requests": [
            {{"document": "...", "why": "...", "how_to_get": "..."}}
          ],
          "additional_analyses": [
            {{"analysis": "...", "why": "...", "data_needed": "..."}}
          ]
        }}
        """

        return self.llm_call(prompt)
```

### 5. Pricing Engine

LLM recommends pricing based on AllSolutions tiers:

```python
class PricingEngine:
    """LLM-driven pricing recommendations."""

    ALLSOLUTIONS_TIERS = """
    ESSENTIAL ($750-1,250/month):
    - Cash basis bookkeeping
    - Up to 5 accounts
    - Unlimited transactions
    - Bank/credit card reconciliation
    - Payroll integration

    PROFESSIONAL ($1,250-2,000/month):
    - Modified accrual basis
    - Up to 10 accounts
    - AR/AP entries (up to 30/month)
    - Up to 5 journal entries/month

    ELITE ($2,000+/month):
    - Full accrual basis
    - Unlimited accounts
    - Full AR/AP management
    - Revenue recognition
    - Expense accruals
    - 5+ journal entries/month

    ADD-ONS:
    - CFO Services: Budgeting, forecasting, KPIs
    - Catch-Up Bookkeeping: Discount for 6+ months
    - Back Office: Full AP/AR, HR/payroll
    - Sales Tax: Avalara integration
    - 1099 Processing: Current clients only
    """

    def generate_quote(
        self,
        client_profile: Dict,
        data_analysis: Dict,
    ) -> Quote:
        """LLM analyzes client and recommends tier."""

        prompt = f"""
        You are a bookkeeping firm pricing a new client.

        YOUR PRICING TIERS:
        {self.ALLSOLUTIONS_TIERS}

        CLIENT PROFILE:
        {client_profile}

        DATA ANALYSIS:
        - Monthly transactions: {data_analysis['transaction_count']}
        - Number of accounts: {data_analysis['account_count']}
        - Platforms used: {data_analysis['platforms']}
        - Has AR/AP needs: {data_analysis['needs_ar_ap']}
        - Accounting basis needed: {data_analysis['basis_recommendation']}
        - Current state: {data_analysis['cleanup_needed']}

        Recommend:
        1. Which tier and why
        2. Specific monthly price within the tier range
        3. Any add-ons needed
        4. One-time cleanup fee if applicable
        5. Key factors driving the recommendation

        Output as structured JSON.
        """

        return self.llm_call(prompt)
```

## Workflow

### Audit Workflow

```
1. INGEST DATA
   - Load files (Python I/O)
   - Generate samples for LLM

2. GATHER CONTEXT (LLM + User)
   - LLM observes data patterns
   - LLM asks user questions
   - User provides context
   - LLM synthesizes understanding

3. RESEARCH (LLM + Web)
   - LLM identifies knowledge gaps
   - LLM searches for platform info
   - LLM synthesizes research

4. PLAN ANALYSIS (LLM)
   - LLM decides what analyses to run
   - LLM checks tool library for relevant tools
   - LLM generates new tools if needed

5. EXECUTE ANALYSIS (LLM + Tools)
   - LLM runs analyses (using/generating tools)
   - LLM interprets results
   - LLM identifies issues needing investigation

6. INVESTIGATE (LLM + User)
   - LLM asks follow-up questions
   - LLM requests documents
   - LLM re-analyzes with new info
   - Loop until satisfied

7. SYNTHESIZE (LLM)
   - LLM curates findings
   - LLM writes narratives
   - LLM generates report
```

### Pricing Workflow

```
1. INGEST DATA
   - Load prospect's financial data

2. ANALYZE COMPLEXITY (LLM)
   - Count transactions, accounts
   - Identify platforms
   - Assess AR/AP needs
   - Determine accounting basis

3. GENERATE QUOTE (LLM)
   - Match to AllSolutions tier
   - Calculate specific price
   - Identify add-ons
   - Estimate cleanup if needed

4. GENERATE PROPOSAL (LLM)
   - Write proposal document
   - Explain value proposition
   - Detail what's included
```

## File Structure

```
/atmix/
├── engine/
│   ├── llm_orchestrator.py      # Main orchestrator (KEEP, enhance)
│   ├── file_processors/         # File ingestion (KEEP)
│   ├── dynamic_tools.py         # NEW: Tool generation and execution
│   ├── research.py              # NEW: Web research integration
│   ├── investigation.py         # NEW: LLM-driven investigation
│   ├── pricing.py               # NEW: LLM-driven pricing
│   └── gates.py                 # Approval gates (KEEP, enhance)
├── tools/                       # NEW: Tool library
│   ├── registry.json
│   ├── parsers/
│   └── analyzers/
├── prompts/                     # LLM prompts (KEEP, enhance)
└── config/
    └── pricing_tiers.json       # AllSolutions tier config
```

## Key Differences from v1/v2

| Aspect | v1 (Failed) | v2 (Current) | v3 (New) |
|--------|-------------|--------------|----------|
| Analysis | Python scripts | LLM with limits | LLM with dynamic tools |
| Domain knowledge | Hardcoded rules | None | LLM research + user context |
| Tool generation | None | None | LLM writes Python on-demand |
| Investigation | None | None | LLM asks questions iteratively |
| Pricing | None | None | LLM recommends based on tiers |
| Platform handling | Static patterns | Basic detection | LLM research + dynamic parsing |

## Success Criteria

1. **LLM stays in control** - Python never makes analytical decisions
2. **Tools are optional** - LLM can always write custom code
3. **Research fills gaps** - LLM can learn about any platform
4. **User context matters** - What they tell us is as important as what we see
5. **Investigation is iterative** - LLM can ask follow-ups until satisfied
