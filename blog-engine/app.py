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


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("📝 Blog Engine")
    st.caption("SEO article production pipeline")

    # ---- New pipeline run ----
    st.markdown("---")
    st.subheader("New Run")

    configs = pipeline.list_configs()
    if not configs:
        st.warning("No configs found in `configs/`.")
    else:
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

        keyword_input = st.text_input("Primary keyword", key="sb_keyword")
        secondary_input = st.text_area(
            "Secondary keywords (one per line)",
            height=80,
            key="sb_secondary_keywords",
        )

        if st.button("Start Run", key="sb_start", type="primary"):
            if not keyword_input.strip():
                st.error("Enter a keyword.")
            else:
                keyword = keyword_input.strip()
                slug = pipeline.slugify(keyword)
                secondary_list = [k.strip() for k in secondary_input.splitlines() if k.strip()]
                run_id = db.create_run(selected_config, keyword, slug, json.dumps(secondary_list))
                st.session_state.active_run_id = run_id
                st.rerun()

    # ---- Resume existing run ----
    st.markdown("---")
    st.subheader("Resume Run")

    runs = db.list_runs(status="active")
    if runs:
        run_options = {
            f"{r['keyword']} ({r['slug']}) — step {r['current_step']}": r["id"]
            for r in runs
        }
        selected_run = st.selectbox(
            "Active runs",
            list(run_options.keys()),
            key="sb_resume_select",
        )
        if st.button("Resume", key="sb_resume"):
            st.session_state.active_run_id = run_options[selected_run]
            st.rerun()
    else:
        st.caption("No active runs.")

    # ---- Completed runs ----
    completed = db.list_runs(status="completed")
    if completed:
        with st.expander(f"Completed ({len(completed)})", expanded=False):
            for r in completed:
                st.markdown(f"- **{r['keyword']}** (`{r['slug']}`)")


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

# ---------------------------------------------------------------------------
# Sidebar — Run cost summary
# ---------------------------------------------------------------------------
def _build_cost_sidebar(steps_list):
    """Render a cost summary from all steps' persisted data."""
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

    with st.sidebar.expander("Run Costs", expanded=False):
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

_build_cost_sidebar(steps)

# Pipeline progress
components.pipeline_progress(pipeline.STEPS, current_step)

st.markdown(f"**Keyword:** {run['keyword']}  |  **Config:** {run['config_name']}  |  **Slug:** `{run['slug']}`")
st.markdown("---")

# Render current step
if run["status"] == "completed":
    st.markdown("## Pipeline Complete")
    st.success(f"Article for **{run['keyword']}** is ready!")

    output_dir = pipeline.get_output_dir(run["slug"])
    st.markdown("### Output Files")
    for f in sorted(output_dir.iterdir()):
        if f.is_file() and not f.name.startswith("hero-option-"):
            size_kb = f.stat().st_size / 1024
            st.markdown(f"- `{f.name}` ({size_kb:.1f} KB)")

    hero_path = output_dir / "hero.webp"
    if hero_path.exists():
        st.image(str(hero_path), caption="Hero Image", use_container_width=True)

elif current_step == 0:
    step_nlp_input.render(run_id, run)
elif current_step == 1:
    step_research.render(run_id, run, config)
elif current_step == 2:
    step_write.render(run_id, run, config)
elif current_step == 3:
    step_review.render(run_id, run, config)

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
            st.rerun()
