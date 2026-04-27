# Audit Engine

LLM-first financial audit system. Claude performs all analysis, planning, and synthesis. Python handles only I/O and orchestration.

## Stack

Python 3.10+, Streamlit (UI), Anthropic SDK, pandas. Deployed on Streamlit Cloud -- auto-deploys from `main` branch. No local venv.

## Architecture

6-phase pipeline with user approval gates:

```
Phase 0: Context Gathering  ->  Phase 1: Data Ingestion  ->  Phase 1.5: Data Prep
Phase 2: LLM Planning  ->  Phase 3: LLM Analysis  ->  Phase 4: Quality Validation
Phase 5: LLM Synthesis  ->  Phase 6: Report Generation (HTML)
```

## Key Files

| File | What |
|------|------|
| `app.py` | Main Streamlit UI (~1500 lines) |
| `atmix/engine/llm_orchestrator.py` | Core LLM orchestration (~2100 lines) |
| `atmix/engine/gates.py` | GateResult, GateDecision, ApprovalGates |
| `run_audit_v2.py` | CLI audit runner |
| `run_pricing.py` | Engagement pricing tool |

## Gotchas

- **No local venv** -- runs on Streamlit Cloud, not locally.
- **Streamlit Cloud** auto-deploys from `main`. Changes to audit-engine/ on main go live automatically.
- Linter/hooks can revert changes silently -- always verify after commit.
