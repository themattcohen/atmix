"""UI for Step 0 -- Keyword Research (SEMRush scrape)."""

import json
import streamlit as st
from pathlib import Path

from lib import db, pipeline, semrush
from ui.components import (
    step_header,
    approve_controls,
    screenshot_viewer,
    error_display,
    json_viewer,
    load_step_data,
    save_step_data,
    load_step_screenshots,
    run_async,
)

STEP_INDEX = 0


def render(run_id: str, run: dict, browser_page):
    """Render the keyword-research step.

    Parameters
    ----------
    run_id : str
        Active pipeline run identifier.
    run : dict
        Row from ``db.get_run(run_id)``.
    browser_page :
        Playwright ``Page`` object (may be *None* if the browser is not yet
        launched).
    """
    step = db.get_step(run_id, STEP_INDEX)
    step_info = pipeline.get_step_info(STEP_INDEX)
    status = step["status"] if step else "pending"
    step_data = load_step_data(step)
    screenshots = load_step_screenshots(step)

    step_header(step_info, status)

    # ------------------------------------------------------------------
    # PENDING / RUNNING -- show scrape button
    # ------------------------------------------------------------------
    if status in ("pending", "running"):
        st.info(f'Keyword: **{run["keyword"]}**')
        secondary_kws = json.loads(run.get("secondary_keywords", "[]"))
        if secondary_kws:
            st.info(f'Secondary: {", ".join(secondary_kws)}')

        # Allow the user to override the keyword before scraping
        edit_key = f"kw_override_{run_id}"
        override = st.text_input(
            "Override keyword (leave blank to keep current)",
            value="",
            key=edit_key,
        )

        if st.button("Scrape SEMRush", key=f"kw_scrape_{run_id}"):
            keyword = override.strip() or run["keyword"]
            if browser_page is None:
                st.error("Browser is not launched. Start the browser first.")
                return

            db.update_step(run_id, STEP_INDEX, status="running")

            with st.spinner(f"Scraping SEMRush for '{keyword}'..."):
                try:
                    kw_data = run_async(
                        semrush.scrape_keyword(browser_page, keyword)
                    )
                except Exception as exc:
                    db.update_step(run_id, STEP_INDEX, status="pending", error=str(exc))
                    st.error(f"Scrape failed: {exc}")
                    return

                # Take a screenshot
                output_dir = pipeline.get_output_dir(run["slug"])
                output_dir.mkdir(parents=True, exist_ok=True)
                ss_path = str(output_dir / "semrush-keyword.png")
                try:
                    run_async(semrush.screenshot_results(browser_page, ss_path))
                except Exception:
                    ss_path = None

                # Persist
                save_step_data(run_id, STEP_INDEX, kw_data)
                ss_list = [ss_path] if ss_path else []
                db.update_step(
                    run_id,
                    STEP_INDEX,
                    status="review",
                    screenshots=json.dumps(ss_list),
                    error=None,
                )
            st.rerun()

    # ------------------------------------------------------------------
    # REVIEW -- show scraped data + approve / edit / redo
    # ------------------------------------------------------------------
    elif status == "review":
        _render_keyword_metrics(step_data)
        if screenshots:
            screenshot_viewer(screenshots[0])
        json_viewer(step_data, label="SEMRush Raw Data")

        action = approve_controls(f"kw_{run_id}")
        if action == "approve":
            db.update_step(run_id, STEP_INDEX, status="approved")
            st.rerun()
        elif action == "edit":
            st.session_state[f"kw_edit_mode_{run_id}"] = True
            st.rerun()
        elif action == "redo":
            db.update_step(run_id, STEP_INDEX, status="pending", output_json=None, screenshots=None, error=None)
            st.rerun()

        # Inline edit mode
        if st.session_state.get(f"kw_edit_mode_{run_id}"):
            _render_edit_mode(run_id, run, step_data, browser_page)

    # ------------------------------------------------------------------
    # APPROVED -- summary
    # ------------------------------------------------------------------
    elif status == "approved":
        _render_keyword_metrics(step_data)
        if screenshots:
            screenshot_viewer(screenshots[0])
        st.success("Keyword research approved.")

    # ------------------------------------------------------------------
    # Error
    # ------------------------------------------------------------------
    error_display(step.get("error") if step else None)


# ======================================================================
# Internal helpers
# ======================================================================

def _render_keyword_metrics(data: dict):
    """Display the key SEMRush metrics as Streamlit metric cards."""
    if not data:
        st.warning("No keyword data available yet.")
        return

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Volume", data.get("volume", "N/A"))
    with col2:
        st.metric("KD %", data.get("keyword_difficulty", data.get("kd", "N/A")))
    with col3:
        st.metric("CPC", f"${data['cpc']}" if data.get("cpc") is not None else "N/A")
    with col4:
        st.metric("Intent", data.get("intent", "N/A"))


def _render_edit_mode(run_id: str, run: dict, current_data: dict, browser_page):
    """Allow the user to type a new keyword and re-scrape."""
    st.markdown("---")
    st.subheader("Edit keyword")
    new_kw = st.text_input(
        "New keyword",
        value=run["keyword"],
        key=f"kw_edit_input_{run_id}",
    )
    if st.button("Re-scrape with new keyword", key=f"kw_rescrape_{run_id}"):
        if browser_page is None:
            st.error("Browser is not launched.")
            return
        keyword = new_kw.strip() or run["keyword"]
        db.update_step(run_id, STEP_INDEX, status="running")
        with st.spinner(f"Re-scraping SEMRush for '{keyword}'..."):
            try:
                kw_data = run_async(
                    semrush.scrape_keyword(browser_page, keyword)
                )
            except Exception as exc:
                db.update_step(run_id, STEP_INDEX, status="review", error=str(exc))
                st.error(f"Re-scrape failed: {exc}")
                return

            output_dir = pipeline.get_output_dir(run["slug"])
            output_dir.mkdir(parents=True, exist_ok=True)
            ss_path = str(output_dir / "semrush-keyword.png")
            try:
                run_async(semrush.screenshot_results(browser_page, ss_path))
            except Exception:
                ss_path = None

            save_step_data(run_id, STEP_INDEX, kw_data)
            ss_list = [ss_path] if ss_path else []
            db.update_step(
                run_id,
                STEP_INDEX,
                status="review",
                screenshots=json.dumps(ss_list),
                error=None,
            )
            # Update the run keyword if changed
            if keyword != run["keyword"]:
                db.update_run(run_id, keyword=keyword)

        st.session_state[f"kw_edit_mode_{run_id}"] = False
        st.rerun()

    if st.button("Cancel edit", key=f"kw_edit_cancel_{run_id}"):
        st.session_state[f"kw_edit_mode_{run_id}"] = False
        st.rerun()
