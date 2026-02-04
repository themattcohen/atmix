# atmix audit engine

LLM-first financial audit system where Claude performs all analysis, planning, and synthesis. Python handles only I/O and orchestration.

## Architecture

```
Phase 0: Context Gathering    → Business type, entity scope
Phase 1: Data Ingestion       → File processors (CSV, XLSX, PDF)
Phase 1.5: Data Prep          → Aggregate, filter, sample, extract, custom
Phase 2: LLM Planning         → What analyses to run
Phase 3: LLM Analysis         → Actual financial analysis
Phase 4: Quality Validation   → Automated + LLM verification
Phase 5: LLM Synthesis        → Narratives, visualizations
Phase 6: Report Generation    → HTML output
```

## Key Components

- **LLMOrchestrator**: 6-phase workflow with user approval gates
- **DataEngineerAgent**: LLM-powered custom data transformations
- **InvestigationEngine**: Follow-up question generation
- **PricingEngine**: Engagement scoping and pricing

## Setup

```bash
cd audit-engine
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key
```

## Usage

```bash
# Run audit
python run_audit_v2.py /path/to/workspace

# Run pricing
python run_pricing.py
```

## Requirements

- Python 3.10+
- Anthropic API key
- pandas, rich, anthropic
