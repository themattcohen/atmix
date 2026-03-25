"""Blog Engine — Streamlit pipeline for SEO article production."""

import json
import os
from pathlib import Path
import streamlit as st
from dotenv import load_dotenv

# Load .env as fallback for non-secret config
load_dotenv(Path(__file__).resolve().parent / ".env")


def setup_api_keys() -> bool:
    """Copy API keys from st.secrets → os.environ (audit-engine pattern).

    Checks os.environ first (set by .env or host), then falls back to
    st.secrets (Streamlit Cloud / .streamlit/secrets.toml).
    """
    keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"]
    for key in keys:
        if os.environ.get(key):
            continue
        try:
            if key in st.secrets:
                os.environ[key] = st.secrets[key]
        except Exception:
            pass
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


setup_api_keys()

from lib import db, pipeline
from lib.costs import format_cost, format_cost_short, sum_costs
from ui import components
from ui import step_nlp_input, step_research, step_write, step_review

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Blog Engine",
    page_icon="📝",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Initialize database on first run
# ---------------------------------------------------------------------------
db.init_db()

# ---------------------------------------------------------------------------
# Session state defaults
# ---------------------------------------------------------------------------
if "active_run_id" not in st.session_state:
    st.session_state.active_run_id = None
if "viewed_step" not in st.session_state:
    st.session_state.viewed_step = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _render_new_run_form():
    """Render the New Run form (config selection, keyword, start button)."""
    configs = pipeline.list_configs()
    if not configs:
        st.warning("No configs found in `configs/`.")
        return

    config_filenames = [c["filename"] for c in configs]
    config_names = {c["filename"]: c["name"] for c in configs}
    selected_config = st.selectbox(
        "Content profile",
        config_filenames,
        format_func=lambda f: config_names.get(f, f),
        key="sb_config",
    )
    st.caption("Content rules for a specific site (author, sources, disclaimers, validation)")

    # Show profile details so user knows what guardrails are active
    try:
        _preview_cfg = pipeline.load_config(selected_config)
        with st.expander("View profile rules", expanded=False):
            _author = _preview_cfg.get("author", {})
            st.markdown(f"**Author:** {_author.get('name', '—')}, {_author.get('credentials', '—')}")
            st.markdown(f"**Tone:** {_preview_cfg.get('content', {}).get('toneGuidance', '—')}")
            st.markdown(f"**Surfer score target:** {_preview_cfg.get('seo', {}).get('surferScoreTarget', '—')}")

            _domains = _preview_cfg.get("research", {}).get("authorityDomains", [])
            if _domains:
                st.markdown(f"**Authority domains:** {', '.join(_domains)}")

            _protected = _preview_cfg.get("content", {}).get("protectedWords", [])
            if _protected:
                st.markdown(f"**Protected words:** {', '.join(_protected)}")

            _val = _preview_cfg.get("validation", {})
            active_rules = []
            if _val.get("requireDisclaimers"):
                active_rules.append("Disclaimers required")
            if _val.get("requireStatuteCitations"):
                active_rules.append("Statute citations required")
            if _val.get("requireDollarAmounts"):
                active_rules.append("Dollar amounts required")
            if _val.get("requireCTAs"):
                active_rules.append("CTAs required")
            if active_rules:
                st.markdown(f"**Validation rules:** {' · '.join(active_rules)}")

            _disc_top = _preview_cfg.get("content", {}).get("disclaimerTop", "")
            _disc_bot = _preview_cfg.get("content", {}).get("disclaimerBottom", "")
            if _disc_top or _disc_bot:
                st.markdown("**Disclaimers:**")
                if _disc_top:
                    st.caption(f"Top: {_disc_top}")
                if _disc_bot:
                    st.caption(f"Bottom: {_disc_bot}")

            _hero = _preview_cfg.get("heroImage", {})
            if _hero:
                st.markdown(f"**Hero style:** {_hero.get('style', '—')}")
                st.markdown(f"**Hero colors:** {_hero.get('colorScheme', '—')}")
    except FileNotFoundError:
        pass

    keyword_input = st.text_input("Keyword", key="sb_keyword")
    with st.expander("Secondary keywords (optional)", expanded=False):
        secondary_input = st.text_area(
            "One per line",
            height=80,
            key="sb_secondary_keywords",
            label_visibility="collapsed",
        )
        st.caption("Added to research brief + article prompts")

    if st.button("Start Run", key="sb_start", type="primary"):
        if not keyword_input.strip():
            st.error("Enter a keyword.")
        else:
            keyword = keyword_input.strip()
            slug = pipeline.slugify(keyword)
            secondary_list = [k.strip() for k in secondary_input.splitlines() if k.strip()]
            new_run_id = db.create_run(selected_config, keyword, slug, json.dumps(secondary_list))
            st.session_state.active_run_id = new_run_id
            st.rerun()


def _sidebar_step_list(steps_list, current_step, run_status="active"):
    """Render vertical pipeline step list in sidebar.

    For completed runs and past steps, steps are clickable buttons that
    set ``st.session_state.viewed_step``.
    """
    viewed = st.session_state.viewed_step

    for s in pipeline.STEPS:
        idx = s["index"]
        icon = s["icon"]
        label = s["label"]

        # Check step status from DB
        step_status = "pending"
        for db_step in steps_list:
            if db_step.get("step_index") == idx:
                step_status = db_step.get("status", "pending")
                break

        is_past = idx < current_step or step_status == "approved"
        is_current = idx == current_step
        is_clickable = run_status == "completed" or is_past

        # Determine which step is "active" in the sidebar
        if viewed is not None:
            is_active = idx == viewed
        else:
            is_active = is_current

        if is_clickable:
            marker = "✅"
            style = "font-weight: bold;" if is_active else ""
            if st.button(
                f"{marker} {icon} {label}",
                key=f"nav_step_{idx}",
                use_container_width=True,
            ):
                st.session_state.viewed_step = idx
                st.rerun()
        elif is_current:
            marker = "🔵"
            st.markdown(
                f'<div style="padding: 2px 0; font-weight: bold;">{marker} {icon} {label}</div>',
                unsafe_allow_html=True,
            )
        else:
            marker = "○"
            st.markdown(
                f'<div style="padding: 2px 0; color: #6c757d;">{marker} {icon} {label}</div>',
                unsafe_allow_html=True,
            )


def _build_cost_sidebar(steps_list):
    """Render a cost summary from all steps' persisted data.

    Must be called within a ``with st.sidebar:`` context.
    """
    # Build a dict of step_index -> step_data
    step_data_map = {}
    for s in steps_list:
        idx = s.get("step_index")
        if idx is not None and s.get("output_json"):
            try:
                step_data_map[idx] = json.loads(s["output_json"])
            except (json.JSONDecodeError, TypeError):
                step_data_map[idx] = {}

    total = 0.0
    has_any_cost = False

    with st.expander("Run Costs", expanded=False):
        # Step 0 — NLP Input
        s0_data = step_data_map.get(0, {})
        s0_cost = s0_data.get("call_info")
        if s0_cost:
            has_any_cost = True
            st.text(f"NLP Input:    {format_cost_short(s0_cost)}")
            total += s0_cost.get("cost_usd", 0)

        # Step 1 — Research Brief
        s1_data = step_data_map.get(1, {})
        s1_cost = s1_data.get("call_info")
        if s1_cost:
            has_any_cost = True
            st.text(f"Research:     {format_cost_short(s1_cost)}")
            total += s1_cost.get("cost_usd", 0)

        # Step 2 — Write Article
        s2_data = step_data_map.get(2, {})
        s2_cost = s2_data.get("call_info")
        if s2_cost:
            has_any_cost = True
            st.text(f"Write:        {format_cost_short(s2_cost)}")
            total += s2_cost.get("cost_usd", 0)

        # Step 3 — Review & Iterate
        s3_data = step_data_map.get(3, {})
        cost_history = s3_data.get("cost_history", [])
        if cost_history:
            has_any_cost = True
            rw_total = sum_costs(cost_history)
            st.text(f"Rewrites (x{len(cost_history)}): ${rw_total:.2f}")
            total += rw_total

        analysis_costs = s3_data.get("analysis_cost_history", [])
        if analysis_costs:
            has_any_cost = True
            an_total = sum_costs(analysis_costs)
            st.text(f"Screenshot analysis (x{len(analysis_costs)}): ${an_total:.2f}")
            total += an_total

        hero_cost = s3_data.get("hero_cost")
        if hero_cost:
            has_any_cost = True
            st.text(f"Hero images:  {format_cost_short(hero_cost)}")
            total += hero_cost.get("cost_usd", 0)

        # Total
        st.divider()
        st.metric("Total Cost", f"${total:.2f}")

        if not has_any_cost:
            st.caption("No API costs recorded yet.")


# ---------------------------------------------------------------------------
# Sidebar — context-aware layout
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("📝 Blog Engine")

    # Check if we have an active run
    run_id = st.session_state.active_run_id

    if run_id:
        # --- Active run layout ---
        run_preview = db.get_run(run_id)
        if run_preview:
            st.markdown("---")
            # Run header with close + delete buttons
            col_slug, col_close, col_delete = st.columns([4, 1, 1])
            with col_slug:
                st.markdown(f"🏷️ `{run_preview['slug']}`")
            with col_close:
                if st.button("✕", key="close_run", help="Close this run"):
                    st.session_state.active_run_id = None
                    st.session_state.viewed_step = None
                    st.rerun()
            with col_delete:
                if st.button("🗑️", key="delete_run", help="Delete this run permanently"):
                    db.delete_run(run_id)
                    st.session_state.active_run_id = None
                    st.rerun()

            st.caption(f"Keyword: {run_preview['keyword']}  ·  Config: {run_preview['config_name']}")

            # Pipeline steps
            st.markdown("---")
            st.markdown("**Pipeline**")
            steps_for_sidebar = db.get_steps(run_id)
            _sidebar_step_list(steps_for_sidebar, run_preview["current_step"], run_preview.get("status", "active"))

            # Costs
            _build_cost_sidebar(steps_for_sidebar)

        st.markdown("---")

        # New Run (collapsed)
        with st.expander("➕ New Run", expanded=False):
            _render_new_run_form()

        # Switch Run (if other active runs exist)
        other_runs = [r for r in db.list_runs(status="active") if r["id"] != run_id]
        if other_runs:
            with st.expander("🔀 Switch Run", expanded=False):
                for r in other_runs:
                    col_label, col_switch, col_del = st.columns([4, 1, 1])
                    with col_label:
                        st.text(f"{r['keyword']} — step {r['current_step']}")
                    with col_switch:
                        if st.button("↗", key=f"switch_{r['id']}", help="Switch to this run"):
                            st.session_state.active_run_id = r["id"]
                            st.session_state.viewed_step = None
                            st.rerun()
                    with col_del:
                        if st.button("🗑️", key=f"del_switch_{r['id']}", help="Delete this run"):
                            db.delete_run(r["id"])
                            st.rerun()
    else:
        # --- No active run layout ---
        st.caption("SEO article production pipeline")

        # Resume Run (show first if active runs exist)
        runs = db.list_runs(status="active")
        if runs:
            st.markdown("---")
            st.subheader("Resume Run")
            for r in runs:
                col_label, col_resume, col_del = st.columns([4, 1, 1])
                with col_label:
                    st.text(f"{r['keyword']} — step {r['current_step']}")
                with col_resume:
                    if st.button("▶", key=f"resume_{r['id']}", help="Resume this run"):
                        st.session_state.active_run_id = r["id"]
                        st.session_state.viewed_step = None
                        st.rerun()
                with col_del:
                    if st.button("🗑️", key=f"del_run_{r['id']}", help="Delete this run"):
                        db.delete_run(r["id"])
                        st.rerun()

        # New Run
        st.markdown("---")
        st.subheader("New Run")
        _render_new_run_form()

    # Completed runs (always visible)
    completed = db.list_runs(status="completed")
    if completed:
        with st.expander(f"Completed ({len(completed)})", expanded=False):
            for r in completed:
                col_label, col_view, col_del = st.columns([4, 1, 1])
                with col_label:
                    st.markdown(f"**{r['keyword']}** (`{r['slug']}`)")
                with col_view:
                    if st.button("👁", key=f"view_{r['id']}", help="View this run"):
                        st.session_state.active_run_id = r["id"]
                        st.session_state.viewed_step = len(pipeline.STEPS) - 1
                        st.rerun()
                with col_del:
                    if st.button("🗑️", key=f"del_done_{r['id']}", help="Delete this run"):
                        db.delete_run(r["id"])
                        st.rerun()


# ---------------------------------------------------------------------------
# Main area
# ---------------------------------------------------------------------------
run_id = st.session_state.active_run_id

if not run_id:
    st.markdown("## Welcome to Blog Engine")
    st.markdown(
        "Use the sidebar to **start a new pipeline run** or **resume an existing one**.\n\n"
        "### Pipeline Steps\n"
    )
    for s in pipeline.STEPS:
        st.markdown(f"{s['icon']} **{s['label']}**")
    st.stop()

# Load active run
run = db.get_run(run_id)
if not run:
    st.error(f"Run not found: {run_id}")
    st.session_state.active_run_id = None
    st.stop()

# Load config
try:
    config = pipeline.load_config(run["config_name"])
except FileNotFoundError:
    st.error(f"Config not found: {run['config_name']}")
    st.stop()

steps = db.get_steps(run_id)
current_step = run["current_step"]

st.markdown("---")

# Determine which step to render
if run["status"] == "completed":
    render_step = st.session_state.viewed_step
    if render_step is None:
        render_step = len(pipeline.STEPS) - 1  # default to last step
else:
    # For active runs, viewed_step overrides current_step (for navigating past steps)
    render_step = st.session_state.viewed_step if st.session_state.viewed_step is not None else current_step

# Render the step
if render_step == 0:
    step_nlp_input.render(run_id, run)
elif render_step == 1:
    step_research.render(run_id, run, config)
elif render_step == 2:
    step_write.render(run_id, run, config)
elif render_step == 3:
    step_review.render(run_id, run, config)

# Reopen button for completed runs
if run["status"] == "completed":
    st.markdown("---")
    if st.button("Reopen for Editing", key=f"reopen_{run_id}"):
        db.update_run(run_id, status="active", current_step=render_step)
        db.update_step(run_id, render_step, status="review")
        st.session_state.viewed_step = None
        st.rerun()

# Advance button (shown when current step is approved)
if run["status"] != "completed" and current_step < len(pipeline.STEPS) - 1:
    current_step_data = db.get_step(run_id, current_step)
    if current_step_data and current_step_data.get("status") == "approved":
        st.markdown("---")
        next_info = pipeline.get_step_info(current_step + 1)
        if st.button(
            f"Advance to {next_info['icon']} {next_info['label']}",
            key=f"advance_step_{run_id}",
            type="primary",
        ):
            pipeline.advance_step(run_id)
            st.session_state.viewed_step = None
            st.rerun()
