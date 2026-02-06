"""atmix audit engine - Interactive Streamlit Web Interface.

Full interactive workflow with approval gates matching the CLI experience.
"""

__version__ = "2.2.0"  # Gate 1 plan refinement now functional

import os
import sys
import tempfile
import time
import json
from pathlib import Path
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

import streamlit as st

# Page config must be first Streamlit command
st.set_page_config(
    page_title="atmix audit engine",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# DEBUG: Show immediately that script is running
st.sidebar.write(f"🔧 v{__version__} loaded")

# Now import pandas (after page config)
import pandas as pd

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))


# === Workflow State ===

class Phase(Enum):
    UPLOAD = "upload"
    CONTEXT = "context"
    DATA_GAPS = "data_gaps"
    PLAN_REVIEW = "plan_review"          # Gate 1
    ANALYSIS_RUNNING = "analysis_running"
    FINDINGS_REVIEW = "findings_review"   # Gate 2
    INVESTIGATION = "investigation"       # LLM asks questions
    SYNTHESIS_RUNNING = "synthesis_running"
    DRAFT_REVIEW = "draft_review"         # Gate 3
    GENERATING = "generating"
    COMPLETE = "complete"
    PRICING = "pricing"                   # Pricing quote generation
    ERROR = "error"


# === Session State Management ===

def init_session():
    """Initialize all session state."""
    # Track reruns for debugging
    if "rerun_count" not in st.session_state:
        st.session_state.rerun_count = 0
    st.session_state.rerun_count += 1
    st.sidebar.write(f"🔄 Rerun #{st.session_state.rerun_count}")

    defaults = {
        # Workflow - store enum object (we compare using .value)
        "phase": Phase.UPLOAD,
        "workspace_path": None,

        # Upload
        "uploaded_files": [],

        # Context
        "business_type": "",
        "business_notes": "",
        "context_questions": [],
        "context_answers": {},

        # Data Gaps
        "data_gaps": None,

        # Planning (Gate 1)
        "analysis_plan": None,
        "plan_display": "",

        # Analysis
        "findings": [],
        "validation_results": None,

        # Investigation
        "investigation_plan": None,
        "investigation_answers": {},
        "investigation_docs": [],

        # Synthesis (Gate 3)
        "synthesis_data": None,

        # Output
        "report_html": None,

        # Pricing
        "pricing_quote": None,
        "pricing_analysis": None,
        "pricing_proposal": None,

        # Metrics
        "total_tokens": 0,
        "start_time": None,
        "error_message": None,

        # Orchestrator instance (persisted)
        "orchestrator": None,
        "data_files": {},
        "data_samples": {},

        # Smart Data Architecture
        "data_catalog": None,  # Full dataset statistics
        "data_frames": {},     # Raw DataFrames for extraction
        "extract_service": None,  # On-demand extract service
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def reset_session():
    """Reset to initial state."""
    # Cleanup temp workspace
    if st.session_state.get("workspace_path"):
        import shutil
        try:
            shutil.rmtree(st.session_state.workspace_path, ignore_errors=True)
        except:
            pass

    for key in list(st.session_state.keys()):
        del st.session_state[key]
    init_session()


# === API Key ===

def setup_api_key() -> bool:
    """Ensure API key is available."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return True
    try:
        if "ANTHROPIC_API_KEY" in st.secrets:
            os.environ["ANTHROPIC_API_KEY"] = st.secrets["ANTHROPIC_API_KEY"]
            return True
    except:
        pass
    return False


# === Orchestrator Integration ===

def get_orchestrator():
    """Get or create orchestrator instance."""
    if st.session_state.orchestrator is None:
        from atmix.engine.llm_orchestrator import LLMOrchestrator
        from atmix.prompts.context_gathering import BusinessContext

        # Verify API key exists
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise ValueError("ANTHROPIC_API_KEY not found. Add it to Streamlit secrets.")

        # Build context
        context = BusinessContext()
        context.business_type = st.session_state.business_type
        context.clarifications = st.session_state.context_answers

        st.session_state.orchestrator = LLMOrchestrator(
            workspace=st.session_state.workspace_path,
            interactive=False,  # We handle UI
            predefined_context=context,
        )
        st.session_state.orchestrator._init_client()

    return st.session_state.orchestrator


def run_data_ingestion():
    """Phase 1: Ingest data files and build data catalog."""
    orch = get_orchestrator()
    data_files, data_samples = orch._ingest_data()
    st.session_state.data_files = data_files
    st.session_state.data_samples = data_samples
    st.session_state.total_tokens = orch.total_tokens

    # Build data catalog for smart analysis
    try:
        from atmix.engine.data_catalog import DataCatalog
        from atmix.engine.data_extract import DataExtractService

        # Load DataFrames for catalog and extraction
        data_frames = {}
        workspace = st.session_state.workspace_path
        if workspace:
            input_dir = workspace / "input"
            for filename in data_files.keys():
                filepath = input_dir / filename
                if filepath.exists():
                    if filename.endswith(".csv"):
                        data_frames[filename] = pd.read_csv(filepath)
                    elif filename.endswith((".xlsx", ".xls")):
                        data_frames[filename] = pd.read_excel(filepath)

        if data_frames:
            # Build catalog with full statistics
            catalog = DataCatalog()
            st.session_state.data_catalog = catalog.build_catalog(data_frames)
            st.session_state.data_frames = data_frames

            # Initialize extract service for on-demand queries
            st.session_state.extract_service = DataExtractService(data_frames, max_rows=200)

    except Exception as e:
        # Non-fatal: catalog is optional enhancement
        import logging
        logging.warning(f"Could not build data catalog: {e}")

    return bool(data_files)


def run_context_gathering():
    """Phase 0: Get context questions from LLM."""
    orch = get_orchestrator()
    result = orch._gather_context(
        st.session_state.data_files,
        st.session_state.data_samples,
    )
    if result:
        st.session_state.context_questions = [
            {"question": q.question, "why": q.why_asking, "options": q.options, "id": q.question}
            for q in result.questions
        ]
    st.session_state.total_tokens = orch.total_tokens


def run_gap_analysis():
    """Phase 0.5: Analyze data gaps."""
    orch = get_orchestrator()
    from atmix.prompts.context_gathering import BusinessContext

    # Build context from answers
    ctx = BusinessContext()
    ctx.business_type = st.session_state.business_type
    ctx.clarifications = st.session_state.context_answers
    ctx.available_data = list(st.session_state.data_files.keys())
    orch.business_context = ctx

    gaps = orch._analyze_data_gaps(ctx, st.session_state.data_files, st.session_state.data_samples)
    if gaps:
        st.session_state.data_gaps = {
            "gaps": [g.__dict__ if hasattr(g, '__dict__') else g for g in (gaps.gaps or [])],
            "proceed_with_caveats": gaps.proceed_with_caveats or [],
        }
    st.session_state.total_tokens = orch.total_tokens


def run_data_prep():
    """Phase 1.5: Prepare large data files."""
    orch = get_orchestrator()
    data_files, data_samples = orch._run_data_prep_phase(
        st.session_state.data_files,
        st.session_state.data_samples,
    )
    st.session_state.data_files = data_files
    st.session_state.data_samples = data_samples
    st.session_state.total_tokens = orch.total_tokens


def run_planning():
    """Phase 2: Generate analysis plan."""
    orch = get_orchestrator()
    try:
        plan = orch._run_planning_phase(
            st.session_state.data_files,
            st.session_state.data_samples,
        )
        if plan:
            st.session_state.analysis_plan = plan.to_dict()
            from atmix.prompts.planning import PlanningPrompts
            st.session_state.plan_display = PlanningPrompts.format_plan_for_display(plan)
            orch.analysis_plan = plan
            st.session_state.total_tokens = orch.total_tokens
            return True
        else:
            st.session_state.error_message = "Planning returned empty result. Check data files."
            return False
    except Exception as e:
        st.session_state.error_message = f"Planning error: {str(e)}"
        st.session_state.total_tokens = orch.total_tokens
        raise  # Re-raise so caller can display it


def refine_plan(feedback: str):
    """Refine the analysis plan based on user feedback."""
    orch = get_orchestrator()
    from atmix.prompts.planning import AnalysisPlan, PlanningPrompts
    from atmix.engine.gates import GateResult, GateDecision

    current_plan = AnalysisPlan.from_dict(st.session_state.analysis_plan)
    gate_result = GateResult(
        decision=GateDecision.MODIFY,
        approved=False,
        feedback=feedback,
    )
    refined = orch._refine_plan(current_plan, gate_result)
    st.session_state.analysis_plan = refined.to_dict()
    st.session_state.plan_display = PlanningPrompts.format_plan_for_display(refined)
    orch.analysis_plan = refined
    st.session_state.total_tokens = orch.total_tokens


def run_analysis():
    """Phase 3: Run all analyses."""
    orch = get_orchestrator()
    from atmix.prompts.planning import AnalysisPlan

    plan = AnalysisPlan.from_dict(st.session_state.analysis_plan)
    findings = orch._run_analysis_phase(plan, st.session_state.data_files)

    st.session_state.findings = findings or []
    orch.all_findings = findings

    # Run validation
    validation = orch._run_validation(findings, list(st.session_state.data_files.keys()))
    st.session_state.validation_results = validation.to_dict() if validation else None

    st.session_state.total_tokens = orch.total_tokens
    return bool(findings)


def run_synthesis():
    """Phase 5: Synthesize report."""
    orch = get_orchestrator()
    from atmix.prompts.planning import AnalysisPlan

    plan = AnalysisPlan.from_dict(st.session_state.analysis_plan)
    synthesis = orch._run_synthesis_phase(st.session_state.findings, plan)

    if synthesis:
        st.session_state.synthesis_data = synthesis
        orch.synthesis_data = synthesis

    st.session_state.total_tokens = orch.total_tokens
    return synthesis is not None


def run_report_generation():
    """Phase 6: Generate final reports."""
    orch = get_orchestrator()
    orch._generate_reports(st.session_state.synthesis_data)

    # Load generated report
    report_path = st.session_state.workspace_path / "output" / "Executive_Report.html"
    if report_path.exists():
        st.session_state.report_html = report_path.read_text()

    st.session_state.total_tokens = orch.total_tokens


def run_investigation():
    """Generate investigation plan - questions and document requests from LLM."""
    orch = get_orchestrator()
    from atmix.engine.investigation import InvestigationEngine
    from atmix.engine.llm_orchestrator import LLMOrchestrator

    # Build business context dict
    ctx = st.session_state.context_answers.copy()
    ctx["business_type"] = st.session_state.business_type

    # Use the planning model for investigation (orch doesn't have .model attribute)
    engine = InvestigationEngine(orch.client, LLMOrchestrator.MODEL_PLANNING)
    plan = engine.analyze_investigation_needs(
        findings=st.session_state.findings,
        business_context=ctx,
        available_data=list(st.session_state.data_files.keys()),
    )

    if plan:
        st.session_state.investigation_plan = plan.to_dict()

    st.session_state.total_tokens = orch.total_tokens
    return plan is not None and not plan.is_empty


def run_investigation_refinement():
    """Refine findings based on user answers and new documents."""
    orch = get_orchestrator()
    from atmix.engine.investigation import InvestigationEngine
    from atmix.engine.llm_orchestrator import LLMOrchestrator

    # Build business context dict
    ctx = st.session_state.context_answers.copy()
    ctx["business_type"] = st.session_state.business_type

    # Process any uploaded documents
    new_docs = {}
    for doc in st.session_state.investigation_docs:
        try:
            if doc.name.endswith(".csv"):
                content = pd.read_csv(doc).to_string()
            elif doc.name.endswith((".xlsx", ".xls")):
                content = pd.read_excel(doc).to_string()
            else:
                content = doc.read().decode("utf-8", errors="ignore")
            new_docs[doc.name] = content[:5000]  # Limit size
        except Exception as e:
            new_docs[doc.name] = f"[Error reading: {e}]"

    engine = InvestigationEngine(orch.client, LLMOrchestrator.MODEL_PLANNING)
    result = engine.refine_findings(
        original_findings=st.session_state.findings,
        question_answers=st.session_state.investigation_answers,
        new_documents=new_docs,
        business_context=ctx,
    )

    if result and result.findings_changed:
        # Update findings with refined versions
        st.session_state.findings = result.updated_findings + result.new_findings

    st.session_state.total_tokens = orch.total_tokens
    return result


def run_pricing_analysis():
    """Generate pricing quote based on audit data."""
    orch = get_orchestrator()
    from atmix.engine.pricing import PricingEngine, ClientAnalysis, Quote

    # Create pricing engine using the orchestrator's client
    engine = PricingEngine(orch.client)

    # Build user context from session state
    user_context = st.session_state.context_answers.copy()
    user_context["business_type"] = st.session_state.business_type

    # Add relevant audit findings context
    if st.session_state.findings:
        # Extract key metrics from findings
        critical_count = len([f for f in st.session_state.findings if f.get("severity") == "critical"])
        high_count = len([f for f in st.session_state.findings if f.get("severity") == "high"])
        user_context["audit_findings_critical"] = critical_count
        user_context["audit_findings_high"] = high_count
        user_context["total_audit_findings"] = len(st.session_state.findings)

    # Analyze prospect using available data
    analysis = engine.analyze_prospect(
        data_files=st.session_state.data_files,
        data_samples=st.session_state.data_samples,
        user_context=user_context,
    )
    st.session_state.pricing_analysis = analysis.to_dict()

    # Generate quote
    quote = engine.generate_quote(analysis, user_context)
    st.session_state.pricing_quote = quote.to_dict()

    # Generate proposal markdown
    company_name = user_context.get("company_name", user_context.get("business_name", "Prospect"))
    if not company_name or company_name in ["", "Prospect"]:
        company_name = f"{st.session_state.business_type} Business"

    proposal = engine.generate_proposal_markdown(
        quote=quote,
        analysis=analysis,
        company_name=company_name,
        contact_name=user_context.get("contact_name"),
    )
    st.session_state.pricing_proposal = proposal

    # Update token count
    st.session_state.total_tokens += engine.total_tokens

    return quote, analysis


# === UI Components ===

def render_sidebar():
    """Sidebar with progress."""
    with st.sidebar:
        st.title("📊 atmix audit")
        st.caption(f"v{__version__}")
        st.divider()

        phases = [
            (Phase.UPLOAD, "1. Upload Files"),
            (Phase.CONTEXT, "2. Business Context"),
            (Phase.DATA_GAPS, "3. Data Assessment"),
            (Phase.PLAN_REVIEW, "4. Review Plan"),
            (Phase.ANALYSIS_RUNNING, "5. Analysis"),
            (Phase.FINDINGS_REVIEW, "6. Review Findings"),
            (Phase.INVESTIGATION, "7. LLM Questions"),
            (Phase.DRAFT_REVIEW, "8. Review Draft"),
            (Phase.COMPLETE, "9. Complete"),
            (Phase.PRICING, "10. Pricing Quote"),
        ]

        current = st.session_state.phase
        current_idx = next((i for i, (p, _) in enumerate(phases) if p == current), 0)

        for i, (phase, name) in enumerate(phases):
            if i < current_idx:
                st.markdown(f"✅ ~~{name}~~")
            elif phase == current:
                st.markdown(f"**→ {name}**")
            else:
                st.markdown(f"○ {name}")

        st.divider()

        # Metrics
        st.metric("Tokens", f"{st.session_state.total_tokens:,}")
        if st.session_state.findings:
            st.metric("Findings", len(st.session_state.findings))

        st.divider()
        if st.button("🔄 Start Over"):
            reset_session()
            st.rerun()


def render_upload():
    """Phase: Upload files."""
    st.write("📍 ENTER render_upload()")

    st.header("Step 1: Upload Financial Data")
    st.markdown("Upload your financial files: **CSV**, **Excel**, **PDF**")

    # Use a container to ensure content persists
    upload_container = st.container()

    with upload_container:
        st.write("📍 Creating file_uploader widget...")

        uploaded = st.file_uploader(
            "Choose files",
            type=["csv", "xlsx", "xls", "pdf"],
            accept_multiple_files=True,
            key="main_uploader",
        )

        st.write(f"📍 Uploader state: type={type(uploaded).__name__}, len={len(uploaded) if uploaded else 0}")

        if uploaded and len(uploaded) > 0:
            st.success(f"✓ {len(uploaded)} file(s) received")

            for i, f in enumerate(uploaded):
                st.write(f"  {i+1}. {f.name}")

            if st.button("Continue →", type="primary", key="continue_btn"):
                with st.spinner("Saving files..."):
                    temp_dir = tempfile.mkdtemp(prefix="atmix_")
                    workspace = Path(temp_dir)
                    input_dir = workspace / "input"
                    input_dir.mkdir(parents=True, exist_ok=True)

                    for f in uploaded:
                        file_path = input_dir / f.name
                        file_path.write_bytes(f.getbuffer())

                    st.session_state.workspace_path = workspace
                    st.session_state.start_time = time.time()
                    st.session_state.phase = Phase.CONTEXT
                    st.rerun()
        else:
            st.info("👆 Select files above to begin")

    st.write("📍 EXIT render_upload()")


def render_context():
    """Phase: Gather business context."""
    st.header("Step 2: Business Context")

    # First run data ingestion
    if not st.session_state.data_files:
        status = st.status("Loading your data files...", expanded=True)
        status.write("📂 Reading uploaded files...")
        status.write("📊 Building data catalog...")
        try:
            run_data_ingestion()

            # Show catalog summary if available
            catalog = st.session_state.get("data_catalog")
            if catalog:
                status.write(f"✓ Cataloged {len(catalog.file_catalogs)} files")
                total_rows = sum(fc.row_count for fc in catalog.file_catalogs.values())
                status.write(f"✓ Total: {total_rows:,} rows analyzed")

            status.update(label="Files loaded & cataloged!", state="complete")
        except Exception as e:
            status.update(label="Error loading files", state="error")
            st.error(f"Failed to load files: {e}")
            st.stop()

    # Get context questions from LLM
    if not st.session_state.context_questions:
        status = st.status("Analyzing files with AI...", expanded=True)
        status.write("🤖 Generating context questions...")
        status.write("This may take 10-30 seconds...")
        try:
            run_context_gathering()
            status.update(label="Analysis complete!", state="complete")
        except Exception as e:
            status.update(label="Error during analysis", state="error")
            st.error(f"API error: {e}")
            st.info("Check that ANTHROPIC_API_KEY is set correctly in Streamlit secrets.")
            st.stop()

    st.markdown("Please answer these questions about your business:")

    with st.form("context_form"):
        # Business type
        business_type = st.selectbox(
            "What type of business is this?",
            ["", "E-commerce", "Professional Services", "Manufacturing",
             "Retail", "SaaS", "Restaurant", "Healthcare", "Other"],
        )

        if business_type == "Other":
            business_type = st.text_input("Specify:")

        st.session_state.business_type = business_type

        # Dynamic questions from LLM
        answers = {}
        for q in st.session_state.context_questions[:5]:  # Limit to 5
            st.markdown(f"**{q['question']}**")
            if q.get("why"):
                st.caption(q["why"])

            q_hash = abs(hash(q['id'])) % 100000  # Stable positive hash

            if q.get("options"):
                # Dropdown with "Other" option for custom text
                options_with_other = [""] + q["options"] + ["Other (type below)"]
                selected = st.selectbox(
                    f"Select for: {q['id'][:30]}",
                    options_with_other,
                    key=f"q_sel_{q_hash}",
                    label_visibility="collapsed",
                )
                if selected == "Other (type below)":
                    answer = st.text_input(
                        "Your answer:",
                        key=f"q_txt_{q_hash}",
                        placeholder="Type your answer...",
                    )
                else:
                    answer = selected
            else:
                answer = st.text_input(
                    f"Answer: {q['id'][:30]}",
                    key=f"q_{q_hash}",
                    label_visibility="collapsed",
                )
            answers[q["id"]] = answer

        # Notes
        notes = st.text_area(
            "Additional context (optional)",
            placeholder="Any specific concerns or focus areas...",
        )
        answers["notes"] = notes

        if st.form_submit_button("Continue →", type="primary"):
            if not business_type:
                st.error("Please select a business type")
            else:
                st.session_state.context_answers = answers
                st.session_state.phase = Phase.DATA_GAPS
                st.rerun()


def render_data_gaps():
    """Phase: Show data gaps."""
    st.header("Step 3: Data Assessment")

    if st.session_state.data_gaps is None:
        status = st.status("Analyzing data completeness...", expanded=True)
        status.write("🔍 Checking for data gaps...")
        try:
            run_gap_analysis()
            status.write("📊 Preparing large files...")
            run_data_prep()  # Also prep large files
            status.update(label="Assessment complete!", state="complete")
        except Exception as e:
            status.update(label="Error during assessment", state="error")
            st.error(f"Analysis error: {e}")
            st.stop()

    gaps = st.session_state.data_gaps

    # Show data catalog summary if available
    catalog = st.session_state.get("data_catalog")
    if catalog:
        st.subheader("📊 Data Catalog Summary")
        st.info("The LLM can see **full statistics** for all your data, enabling smarter analysis.")

        # Show file summaries
        for filename, file_cat in catalog.file_catalogs.items():
            with st.expander(f"📄 {filename} ({file_cat.row_count:,} rows)"):
                st.markdown(f"**Columns:** {', '.join(ci.name for ci in file_cat.column_info)}")
                if file_cat.date_ranges:
                    dr = file_cat.date_ranges[0]
                    st.markdown(f"**Date Range:** {dr.min_date} to {dr.max_date}")
                if file_cat.numeric_summaries:
                    for summary in file_cat.numeric_summaries[:3]:
                        st.markdown(f"**{summary.column_name}:** sum={summary.sum_value:,.2f}, range={summary.min_value:,.2f} to {summary.max_value:,.2f}")
                if file_cat.potential_anomalies:
                    st.warning(f"⚠️ {len(file_cat.potential_anomalies)} potential anomalies detected")
    else:
        # Fallback: simple file list
        st.subheader("📁 Available Data")
        for filename in st.session_state.data_files.keys():
            st.markdown(f"- ✓ {filename}")

    if gaps and gaps.get("gaps"):
        st.subheader("⚠️ Data Gaps Identified")
        st.warning(f"Found {len(gaps['gaps'])} potential data gap(s)")

        for gap in gaps["gaps"]:
            if isinstance(gap, dict):
                desc = gap.get("description", gap.get("gap_type", str(gap)))
                impact = gap.get("impact", "May affect analysis accuracy")
                recommendation = gap.get("recommendation", gap.get("how_to_resolve", ""))
            else:
                desc = str(gap)
                impact = "May affect analysis accuracy"
                recommendation = ""

            with st.expander(f"📋 {desc}"):
                st.markdown(f"**Impact:** {impact}")
                if recommendation:
                    st.markdown(f"**Recommendation:** {recommendation}")
                st.markdown("---")
                st.markdown("*You can upload additional files or provide context below.*")

    if gaps and gaps.get("proceed_with_caveats"):
        st.subheader("📝 Notes for Proceeding")
        st.info("Proceeding with available data may have these limitations:")
        for caveat in gaps["proceed_with_caveats"]:
            st.markdown(f"- {caveat}")

    # Allow user to provide additional context about gaps
    with st.expander("💬 Provide additional context (optional)"):
        gap_context = st.text_area(
            "Explain any data limitations or provide context:",
            placeholder="e.g., 'We only have 6 months of data because the business started in July...'",
            key="gap_context",
        )
        if gap_context:
            st.session_state.context_answers["data_gap_context"] = gap_context

    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Proceed with Available Data →", type="primary"):
            st.session_state.phase = Phase.PLAN_REVIEW
            st.rerun()
    with col2:
        if st.button("← Upload More Files"):
            st.session_state.phase = Phase.UPLOAD
            st.rerun()


def render_plan_review():
    """Gate 1: Review analysis plan."""
    st.header("🚦 Gate 1: Analysis Plan Approval")

    st.markdown("Review the proposed analysis plan. **Approval required to continue.**")

    if st.session_state.analysis_plan is None:
        status = st.status("Creating analysis plan...", expanded=True)
        status.write("🤖 AI is planning the audit approach...")
        status.write("This may take 30-60 seconds...")

        # Show what data we're working with
        status.write(f"📁 Data files: {list(st.session_state.data_files.keys())}")

        try:
            if not run_planning():
                status.update(label="Planning failed", state="error")
                error_msg = st.session_state.get("error_message", "Unknown error")
                st.error(f"Failed to generate plan: {error_msg}")

                # Show debug info
                with st.expander("Debug info"):
                    st.write("**Data files:**", list(st.session_state.data_files.keys()))
                    st.write("**Business type:**", st.session_state.business_type)
                    st.write("**Context answers:**", st.session_state.context_answers)

                if st.button("← Go back to upload"):
                    st.session_state.phase = Phase.UPLOAD
                    st.session_state.analysis_plan = None
                    st.rerun()
                return
            status.update(label="Plan ready!", state="complete")
        except Exception as e:
            status.update(label="Error creating plan", state="error")
            st.error(f"Planning error: {e}")
            import traceback
            with st.expander("Error details"):
                st.code(traceback.format_exc())
            if st.button("← Go back"):
                st.session_state.phase = Phase.UPLOAD
                st.rerun()
            return

    # Display plan
    plan = st.session_state.analysis_plan

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Planned Analyses", len(plan.get("planned_analyses", [])))
    with col2:
        st.metric("Business Type", plan.get("business_type", "Unknown"))

    st.markdown(f"**Assessment:** {plan.get('business_description', '')[:500]}")

    st.subheader("Planned Analyses")
    for i, analysis in enumerate(plan.get("planned_analyses", []), 1):
        with st.expander(f"{i}. {analysis.get('name', 'Analysis')}"):
            st.markdown(f"**Type:** {analysis.get('type', 'general')}")
            if analysis.get("questions_to_answer"):
                st.markdown("**Questions:**")
                for q in analysis["questions_to_answer"]:
                    st.markdown(f"- {q}")

    st.divider()
    st.subheader("Your Decision")

    decision = st.radio(
        "How would you like to proceed?",
        ["Approve this plan", "Request modifications", "Cancel audit"],
        key="plan_decision",
    )

    if decision == "Request modifications":
        feedback = st.text_area("What modifications do you want?", key="plan_modifications")

    col1, col2, col3 = st.columns(3)
    with col1:
        if decision == "Approve this plan":
            if st.button("✅ Approve & Run Analysis", type="primary"):
                st.session_state.phase = Phase.ANALYSIS_RUNNING
                st.rerun()
    with col2:
        if decision == "Request modifications":
            if st.button("🔄 Refine Plan", type="primary"):
                if feedback:
                    with st.status("Refining plan based on your feedback...", expanded=True) as status:
                        status.write("🤖 AI is regenerating the analysis plan...")
                        try:
                            refine_plan(feedback)
                            status.update(label="Plan refined!", state="complete")
                        except Exception as e:
                            status.update(label="Refinement failed", state="error")
                            st.error(f"Plan refinement error: {e}")
                            return
                    st.rerun()
                else:
                    st.warning("Please describe what modifications you want.")
    with col3:
        if decision == "Cancel audit":
            if st.button("❌ Cancel"):
                reset_session()
                st.rerun()


def render_analysis_running():
    """Phase: Running analysis."""
    st.header("Step 5: Running Analysis")

    status = st.status("Running financial analysis...", expanded=True)
    status.write("🤖 AI is analyzing your financial data...")
    status.write("⏱️ This typically takes 2-5 minutes...")

    try:
        if run_analysis():
            status.update(label="Analysis complete!", state="complete")
            st.session_state.phase = Phase.FINDINGS_REVIEW
        else:
            status.update(label="Analysis failed", state="error")
            st.session_state.phase = Phase.ERROR
            st.session_state.error_message = "Analysis failed to produce findings"
    except Exception as e:
        status.update(label="Analysis error", state="error")
        st.session_state.phase = Phase.ERROR
        st.session_state.error_message = f"Analysis error: {e}"

    st.rerun()


def render_findings_review():
    """Gate 2: Review findings."""
    st.header("🚦 Gate 2: Findings Approval")

    st.markdown("Review the analysis findings. **Approval required to continue.**")

    findings = st.session_state.findings
    validation = st.session_state.validation_results

    # Summary metrics
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Findings", len(findings))
    with col2:
        if validation:
            st.metric("Validation Score", f"{validation.get('overall_score', 0):.0%}")
    with col3:
        critical = len([f for f in findings if f.get("severity") == "critical"])
        st.metric("Critical Issues", critical)

    # Group by severity
    severity_order = ["critical", "high", "medium", "low", "info"]
    by_severity = {}
    for f in findings:
        sev = f.get("severity", "info")
        by_severity.setdefault(sev, []).append(f)

    for sev in severity_order:
        if sev not in by_severity:
            continue

        icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢", "info": "🔵"}[sev]
        count = len(by_severity[sev])

        st.subheader(f"{icon} {sev.upper()} ({count})")

        for f in by_severity[sev][:5]:  # Show top 5 per severity
            with st.expander(f["title"]):
                st.markdown(f["detail"])
                if f.get("evidence"):
                    st.caption(f"Evidence: {', '.join(f['evidence'][:3])}")

        if count > 5:
            st.caption(f"...and {count - 5} more {sev} findings")

    st.divider()
    st.subheader("Your Decision")

    decision = st.radio(
        "How would you like to proceed?",
        ["Approve findings", "Request re-analysis", "Cancel audit"],
        key="findings_decision",
    )

    if decision == "Request re-analysis":
        reanalysis_notes = st.text_area(
            "What should be re-analyzed?",
            key="reanalysis_notes",
            placeholder="e.g., 'Focus more on cash flow patterns' or 'Check vendor payments in detail'"
        )

    col1, col2, col3 = st.columns(3)
    with col1:
        if decision == "Approve findings":
            if st.button("✅ Approve & Continue", type="primary"):
                st.session_state.phase = Phase.INVESTIGATION
                st.rerun()
    with col2:
        if decision == "Request re-analysis":
            if st.button("🔄 Re-run Analysis", type="primary"):
                # Clear findings and go back to analysis
                st.session_state.findings = []
                st.session_state.validation_results = None
                if reanalysis_notes:
                    st.session_state.context_answers["reanalysis_notes"] = reanalysis_notes
                st.session_state.phase = Phase.ANALYSIS_RUNNING
                st.rerun()
    with col3:
        if decision == "Cancel audit":
            if st.button("❌ Cancel"):
                reset_session()
                st.rerun()


def render_investigation():
    """Phase: LLM asks questions and requests documents."""
    st.header("🔍 Investigation: LLM Questions")

    st.markdown("""
    The LLM has analyzed your data and has **questions** that would help improve the audit.
    Answer what you can - you can skip questions you don't know.
    """)

    # Generate investigation plan if not done
    if st.session_state.investigation_plan is None:
        with st.spinner("LLM generating questions..."):
            has_questions = run_investigation()
            if not has_questions:
                st.info("No investigation questions needed. Proceeding to synthesis.")
                st.session_state.phase = Phase.SYNTHESIS_RUNNING
                st.rerun()

    plan = st.session_state.investigation_plan
    if not plan:
        st.session_state.phase = Phase.SYNTHESIS_RUNNING
        st.rerun()
        return

    # Summary
    if plan.get("summary"):
        st.info(plan["summary"])

    # Questions section
    questions = plan.get("questions", [])
    if questions:
        st.subheader(f"📋 Questions for You ({len(questions)})")

        # Sort by priority
        priority_order = {"blocking": 0, "high": 1, "medium": 2, "low": 3}
        sorted_questions = sorted(questions, key=lambda q: priority_order.get(q.get("priority", "medium"), 2))

        answers = st.session_state.investigation_answers.copy()

        for i, q in enumerate(sorted_questions):
            priority = q.get("priority", "medium")
            priority_icon = {"blocking": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(priority, "⚪")

            with st.expander(f"{priority_icon} {q['question']}", expanded=(priority in ["blocking", "high"])):
                if q.get("why_asking"):
                    st.caption(f"Why we're asking: {q['why_asking']}")
                if q.get("related_finding"):
                    st.caption(f"Related to: {q['related_finding']}")

                q_key = f"inv_q_{i}"
                if q.get("options"):
                    answer = st.selectbox(
                        "Your answer:",
                        ["(Skip this question)"] + q["options"] + ["Other..."],
                        key=q_key,
                    )
                    if answer == "Other...":
                        answer = st.text_input("Specify:", key=f"{q_key}_other")
                    elif answer == "(Skip this question)":
                        answer = ""
                else:
                    answer = st.text_area(
                        "Your answer:",
                        key=q_key,
                        placeholder="Type your answer or leave blank to skip...",
                    )

                if answer and answer != "(Skip this question)":
                    answers[q["question"]] = answer

        st.session_state.investigation_answers = answers

    # Document requests section
    doc_requests = plan.get("document_requests", [])
    if doc_requests:
        st.subheader(f"📄 Document Requests ({len(doc_requests)})")

        for d in doc_requests:
            priority = d.get("priority", "medium")
            priority_icon = {"blocking": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(priority, "⚪")

            with st.expander(f"{priority_icon} {d.get('document_name', 'Document')}"):
                st.markdown(d.get("description", ""))
                st.caption(f"Why needed: {d.get('why_needed', '')}")
                st.caption(f"How to get: {d.get('how_to_get', '')}")

        uploaded_docs = st.file_uploader(
            "Upload additional documents (optional)",
            type=["csv", "xlsx", "xls", "pdf", "txt"],
            accept_multiple_files=True,
            key="investigation_uploader",
        )
        if uploaded_docs:
            st.session_state.investigation_docs = uploaded_docs

    # Additional analyses section (informational)
    additional = plan.get("additional_analyses", [])
    if additional:
        st.subheader("🔬 Additional Analyses Possible")
        for a in additional[:3]:
            st.markdown(f"- **{a.get('name', 'Analysis')}**: {a.get('description', '')}")

    st.divider()

    # Action buttons
    answered_count = len([a for a in st.session_state.investigation_answers.values() if a])
    docs_count = len(st.session_state.investigation_docs)

    st.markdown(f"**Answered:** {answered_count}/{len(questions)} questions")
    if docs_count:
        st.markdown(f"**Uploaded:** {docs_count} additional document(s)")

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("✅ Submit Answers & Continue", type="primary"):
            if answered_count > 0 or docs_count > 0:
                with st.spinner("Refining findings with your answers..."):
                    run_investigation_refinement()
            st.session_state.phase = Phase.SYNTHESIS_RUNNING
            st.rerun()

    with col2:
        if st.button("⏭️ Skip Investigation"):
            st.session_state.phase = Phase.SYNTHESIS_RUNNING
            st.rerun()

    with col3:
        if st.button("🔄 Ask More Questions"):
            st.session_state.investigation_plan = None
            st.rerun()


def render_synthesis_running():
    """Phase: Running synthesis."""
    st.header("Step 7: Synthesizing Report")

    with st.spinner("LLM synthesizing findings into report..."):
        if run_synthesis():
            st.session_state.phase = Phase.DRAFT_REVIEW
        else:
            st.session_state.phase = Phase.ERROR
            st.session_state.error_message = "Synthesis failed"

    st.rerun()


def render_draft_review():
    """Gate 3: Review draft report."""
    st.header("🚦 Gate 3: Draft Report Approval")

    st.markdown("Review the draft report. **Approval required to generate final report.**")

    synthesis = st.session_state.synthesis_data

    if synthesis:
        # Executive summary
        st.subheader("Executive Summary")
        st.markdown(synthesis.get("executive_summary", "No summary available"))

        # Key metrics
        metrics = synthesis.get("metric_cards", [])
        if metrics:
            st.subheader("Key Metrics")
            cols = st.columns(min(len(metrics), 4))
            for i, m in enumerate(metrics[:4]):
                with cols[i]:
                    st.metric(m.get("title", "Metric"), m.get("value", "N/A"))

        # Curated findings
        curated = synthesis.get("curated_findings", [])
        if curated:
            st.subheader(f"Top {len(curated)} Findings")
            for f in curated[:5]:
                with st.expander(f"{f.get('rank', '?')}. {f.get('title', 'Finding')}"):
                    st.markdown(f.get("narrative", f.get("detail", "")))

        # Questions
        questions = synthesis.get("management_questions", [])
        if questions:
            st.subheader("Questions for Management")
            for q in questions[:5]:
                st.markdown(f"- **{q.get('question', q)}**")

    st.divider()
    st.subheader("Your Decision")

    decision = st.radio(
        "How would you like to proceed?",
        ["Approve and generate final report", "Request changes", "Cancel"],
        key="draft_decision",
    )

    col1, col2 = st.columns(2)
    with col1:
        if decision == "Approve and generate final report":
            if st.button("✅ Generate Final Report", type="primary"):
                st.session_state.phase = Phase.GENERATING
                st.rerun()
    with col2:
        if decision == "Cancel":
            if st.button("❌ Cancel"):
                reset_session()
                st.rerun()


def render_generating():
    """Phase: Generate final reports."""
    st.header("Generating Reports")

    with st.spinner("Generating final HTML report..."):
        run_report_generation()
        st.session_state.phase = Phase.COMPLETE

    st.rerun()


def render_complete():
    """Phase: Complete - show results."""
    st.header("✅ Audit Complete!")

    st.success("Your financial audit has been completed.")

    # Metrics
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Findings", len(st.session_state.findings))
    with col2:
        st.metric("Tokens Used", f"{st.session_state.total_tokens:,}")
    with col3:
        if st.session_state.start_time:
            duration = time.time() - st.session_state.start_time
            st.metric("Duration", f"{duration:.0f}s")

    # Report tabs
    tab1, tab2 = st.tabs(["📄 View Report", "⬇️ Download"])

    with tab1:
        if st.session_state.report_html:
            st.components.v1.html(st.session_state.report_html, height=800, scrolling=True)

    with tab2:
        if st.session_state.report_html:
            st.download_button(
                "Download HTML Report",
                st.session_state.report_html,
                f"atmix_audit_{datetime.now().strftime('%Y%m%d')}.html",
                "text/html",
                type="primary",
            )

    # Pricing quote section
    st.divider()
    st.subheader("💰 Generate Pricing Quote")
    st.markdown("""
    Based on the audit analysis, generate a pricing quote for bookkeeping services.
    This uses the data and findings from the audit to recommend appropriate service tiers.
    """)

    if st.button("Generate Pricing Quote", type="primary", key="generate_pricing_btn"):
        st.session_state.phase = Phase.PRICING
        st.rerun()


def render_pricing():
    """Phase: Pricing quote display."""
    st.header("💰 Pricing Quote")

    # Generate pricing if not already done
    if st.session_state.pricing_quote is None:
        status = st.status("Generating pricing quote...", expanded=True)
        status.write("🤖 Analyzing business needs...")
        status.write("💵 Calculating recommended pricing...")

        try:
            quote, analysis = run_pricing_analysis()
            status.update(label="Quote generated!", state="complete")
        except Exception as e:
            status.update(label="Error generating quote", state="error")
            st.error(f"Pricing error: {e}")
            import traceback
            with st.expander("Error details"):
                st.code(traceback.format_exc())
            if st.button("← Back to Report"):
                st.session_state.phase = Phase.COMPLETE
                st.rerun()
            return

    # Load quote and analysis from session state
    from atmix.engine.pricing import Quote, ClientAnalysis

    quote = Quote.from_dict(st.session_state.pricing_quote)
    analysis = ClientAnalysis.from_dict(st.session_state.pricing_analysis)

    # Display tier recommendation
    tier_colors = {
        "Essential": "green",
        "Professional": "blue",
        "Elite": "violet",
    }
    tier_color = tier_colors.get(quote.recommended_tier, "gray")

    st.markdown(f"### Recommended Tier: :{tier_color}[{quote.recommended_tier}]")

    # Pricing metrics
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Monthly Fee", f"${quote.monthly_price:,}")
    with col2:
        st.metric("Annual Cost", f"${quote.annual_cost:,}")
    with col3:
        st.metric("First Month Total", f"${quote.total_first_month:,}")

    # Rationale
    st.subheader("Pricing Rationale")
    st.info(quote.price_rationale)

    # One-time fees
    if quote.cleanup_fee or quote.setup_fee:
        st.subheader("One-Time Fees")
        fee_cols = st.columns(2)
        with fee_cols[0]:
            if quote.setup_fee:
                st.metric("Setup Fee", f"${quote.setup_fee:,}")
        with fee_cols[1]:
            if quote.cleanup_fee:
                st.metric("Catch-Up Bookkeeping", f"${quote.cleanup_fee:,}")
                if analysis.months_behind:
                    st.caption(f"{analysis.months_behind} months behind, ~{analysis.estimated_cleanup_hours} hours estimated")

    # Included services
    st.subheader("Included Services")
    for service in quote.included_services:
        st.markdown(f"- [x] {service}")

    # Recommended add-ons
    if quote.recommended_addons:
        st.subheader("Recommended Add-Ons")
        for addon_name in quote.recommended_addons:
            st.markdown(f"- **{addon_name}**")
        if quote.addon_rationale:
            st.caption(quote.addon_rationale)

    # Key factors
    with st.expander("Key Pricing Factors"):
        for factor in quote.key_factors:
            st.markdown(f"- {factor}")

    # Assumptions
    if quote.assumptions:
        with st.expander("Assumptions"):
            for assumption in quote.assumptions:
                st.markdown(f"- {assumption}")

    # Confidence and validity
    st.divider()
    conf_col1, conf_col2 = st.columns(2)
    with conf_col1:
        confidence_pct = int(quote.confidence * 100)
        if confidence_pct >= 80:
            st.success(f"Confidence: {confidence_pct}%")
        elif confidence_pct >= 60:
            st.warning(f"Confidence: {confidence_pct}%")
        else:
            st.error(f"Confidence: {confidence_pct}% - Manual review recommended")
    with conf_col2:
        if quote.valid_until:
            st.info(f"Valid Until: {quote.valid_until.strftime('%Y-%m-%d')}")

    # Notes
    if quote.notes:
        st.caption(f"Notes: {quote.notes}")

    # Download proposal
    st.divider()
    st.subheader("Download Proposal")

    if st.session_state.pricing_proposal:
        st.download_button(
            "Download Proposal (Markdown)",
            st.session_state.pricing_proposal,
            f"atmix_proposal_{datetime.now().strftime('%Y%m%d')}.md",
            "text/markdown",
            type="primary",
        )

        with st.expander("Preview Proposal"):
            st.markdown(st.session_state.pricing_proposal)

    # Navigation
    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        if st.button("← Back to Audit Report"):
            st.session_state.phase = Phase.COMPLETE
            st.rerun()
    with col2:
        if st.button("🔄 Regenerate Quote"):
            st.session_state.pricing_quote = None
            st.session_state.pricing_analysis = None
            st.session_state.pricing_proposal = None
            st.rerun()


def render_error():
    """Phase: Error."""
    st.header("❌ Error")
    st.error(st.session_state.error_message or "An error occurred")

    if st.button("Start Over"):
        reset_session()
        st.rerun()


# === Main ===

def main():
    # Debug: Show we reached main
    debug_mode = os.environ.get("DEBUG", "").lower() == "true"

    try:
        init_session()
    except Exception as e:
        st.error(f"Init error: {e}")
        st.stop()

    if not setup_api_key():
        st.error("⚠️ ANTHROPIC_API_KEY not configured")
        st.info("Add your API key in Streamlit secrets or environment variable")
        st.stop()

    try:
        render_sidebar()
    except Exception as e:
        st.error(f"Sidebar error: {e}")

    # DEBUG: Show phase info in main area
    st.write("---")
    st.write(f"🔧 DEBUG v{__version__}")
    st.write(f"Session keys: {list(st.session_state.keys())}")

    phase = st.session_state.phase
    st.write(f"Phase type: {type(phase)}")
    st.write(f"Phase value: {phase}")

    # Check if phase is valid
    try:
        phase_value = phase.value if hasattr(phase, 'value') else str(phase)
        st.write(f"Phase.value: {phase_value}")
    except Exception as e:
        st.error(f"Phase error: {e}")
        phase = Phase.UPLOAD  # Reset to safe value
        st.session_state.phase = phase

    # Render current phase with error handling
    # NOTE: Compare using .value strings because enum objects don't survive Streamlit reruns
    phase_str = phase.value if hasattr(phase, 'value') else str(phase)

    try:
        if phase_str == "upload":
            render_upload()
        elif phase_str == "context":
            render_context()
        elif phase_str == "data_gaps":
            render_data_gaps()
        elif phase_str == "plan_review":
            render_plan_review()
        elif phase_str == "analysis_running":
            render_analysis_running()
        elif phase_str == "findings_review":
            render_findings_review()
        elif phase_str == "investigation":
            render_investigation()
        elif phase_str == "synthesis_running":
            render_synthesis_running()
        elif phase_str == "draft_review":
            render_draft_review()
        elif phase_str == "generating":
            render_generating()
        elif phase_str == "complete":
            render_complete()
        elif phase_str == "pricing":
            render_pricing()
        elif phase_str == "error":
            render_error()
        else:
            st.error(f"Unknown phase: {phase_str}")
            render_upload()  # Fallback
    except Exception as e:
        st.error(f"🚨 Render error in {phase.value}: {e}")
        import traceback
        st.code(traceback.format_exc())
        if st.button("Reset App"):
            reset_session()
            st.rerun()


if __name__ == "__main__":
    main()
