"""Blog Engine — Streamlit pipeline for SEO article production."""

import json
import os
import sys
import streamlit as st
from pathlib import Path
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
from lib.browser import BrowserManager
from ui import components
from ui import step_keyword, step_nlp, step_research, step_write, step_score, step_image

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
if "browser_manager" not in st.session_state:
    st.session_state.browser_manager = BrowserManager()
if "browser_page" not in st.session_state:
    st.session_state.browser_page = None
if "active_run_id" not in st.session_state:
    st.session_state.active_run_id = None


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("📝 Blog Engine")
    st.caption("SEO article production pipeline")

    # ---- Browser controls ----
    st.markdown("---")
    st.subheader("Browser")
    bm: BrowserManager = st.session_state.browser_manager

    if bm.is_launched:
        st.success("Browser: running")

        col1, col2 = st.columns(2)
        with col1:
            if st.button("Check logins", key="sb_check_logins"):
                semrush_ok = components.run_async(bm.check_login("semrush"))
                surfer_ok = components.run_async(bm.check_login("surfer"))
                st.session_state["login_semrush"] = semrush_ok
                st.session_state["login_surfer"] = surfer_ok
        with col2:
            if st.button("Stop browser", key="sb_stop_browser"):
                components.run_async(bm.close())
                st.session_state.browser_page = None
                st.rerun()

        semrush_ok = st.session_state.get("login_semrush")
        surfer_ok = st.session_state.get("login_surfer")
        if semrush_ok is not None:
            st.markdown(f"SEMRush: {'✅' if semrush_ok else '❌'}")
        if surfer_ok is not None:
            st.markdown(f"Surfer: {'✅' if surfer_ok else '❌'}")
    else:
        _is_headless_server = sys.platform == "linux" and not os.environ.get("DISPLAY")
        if _is_headless_server:
            headless = True
            st.caption("Headless mode forced (no display server detected)")
        else:
            headless = st.checkbox("Headless mode", value=True, key="sb_headless")
        if st.button("Launch browser", key="sb_launch_browser", type="primary"):
            with st.spinner("Launching Chromium..."):
                st.session_state.browser_manager = BrowserManager(headless=headless)
                bm = st.session_state.browser_manager
                try:
                    components.run_async(bm.launch())
                    page = components.run_async(bm.new_page())
                    st.session_state.browser_page = page
                except Exception as exc:
                    st.session_state.browser_manager = BrowserManager()
                    st.error(f"Browser launch failed: {exc}")
                    return
            st.rerun()
        if not _is_headless_server:
            st.caption(
                "First run? Uncheck headless, launch, then manually log into "
                "SEMRush and Surfer in the browser window. Cookies persist."
            )

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

        if st.button("Start Pipeline", key="sb_start", type="primary"):
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

# Pipeline progress
components.pipeline_progress(pipeline.STEPS, current_step)

st.markdown(f"**Keyword:** {run['keyword']}  |  **Config:** {run['config_name']}  |  **Slug:** `{run['slug']}`")
st.markdown("---")

# Get browser page (may be None)
browser_page = st.session_state.get("browser_page")

# Render current step
if current_step == 0:
    step_keyword.render(run_id, run, browser_page)
elif current_step == 1:
    step_nlp.render(run_id, run, browser_page)
elif current_step == 2:
    step_research.render(run_id, run, config)
elif current_step == 3:
    step_write.render(run_id, run, config)
elif current_step == 4:
    step_score.render(run_id, run, config, browser_page)
elif current_step == 5:
    step_image.render(run_id, run, config)
elif current_step == 6:
    # Done step
    st.markdown("## ✅ Pipeline Complete")
    st.success(f"Article for **{run['keyword']}** is ready!")

    output_dir = pipeline.get_output_dir(run["slug"])
    st.markdown("### Output Files")
    for f in sorted(output_dir.iterdir()):
        if f.is_file() and not f.name.startswith("hero-option-"):
            size_kb = f.stat().st_size / 1024
            st.markdown(f"- `{f.name}` ({size_kb:.1f} KB)")

    # Show hero image if available
    hero_path = output_dir / "hero.webp"
    if hero_path.exists():
        st.image(str(hero_path), caption="Hero Image", use_container_width=True)

# Advance button (shown when current step is approved)
if current_step < len(pipeline.STEPS) - 1:
    current_step_data = db.get_step(run_id, current_step)
    if current_step_data and current_step_data.get("status") == "approved":
        st.markdown("---")
        next_info = pipeline.get_step_info(current_step + 1)
        if st.button(
            f"➡️ Advance to {next_info['icon']} {next_info['label']}",
            key="advance_step",
            type="primary",
        ):
            pipeline.advance_step(run_id)
            st.rerun()
