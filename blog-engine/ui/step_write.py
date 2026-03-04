"""UI for Step 2 -- Article Writing (Claude + local validation)."""

import json
import streamlit as st
from pathlib import Path

from lib import db, pipeline, writer, scorer
from lib.costs import format_cost
from ui.components import (
    step_header,
    approve_controls,
    error_display,
    json_viewer,
    load_step_data,
    save_step_data,
)

STEP_INDEX = 2


def render(run_id: str, run: dict, config: dict):
    """Render the article writing step.

    Parameters
    ----------
    run_id : str
        Active pipeline run identifier.
    run : dict
        Row from ``db.get_run(run_id)``.
    config : dict
        Loaded pipeline configuration.
    """
    step = db.get_step(run_id, STEP_INDEX)
    step_info = pipeline.get_step_info(STEP_INDEX)
    status = step["status"] if step else "pending"
    step_data = load_step_data(step)

    step_header(step_info, status)

    # ------------------------------------------------------------------
    # PENDING -- write button + optional instructions
    # ------------------------------------------------------------------
    if status == "pending":
        st.info(f'Keyword: **{run["keyword"]}**')

        additional = st.text_area(
            "Additional instructions for the writer (optional)",
            value="",
            height=120,
            key=f"wr_extra_{run_id}",
        )

        if st.button("Write Article", key=f"wr_gen_{run_id}", type="primary"):
            st.session_state[f"wr_additional_{run_id}"] = additional.strip()
            db.update_step(run_id, STEP_INDEX, status="running")
            st.rerun()

    # ------------------------------------------------------------------
    # RUNNING -- spinner + generation
    # ------------------------------------------------------------------
    elif status == "running":
        additional = st.session_state.get(f"wr_additional_{run_id}", "")

        with st.status("Writing article...", expanded=True) as gen_status:
            # Load inputs from previous steps
            brief = _load_research_brief(run)
            nlp_targets = _load_nlp_targets(run)

            secondary_kws = json.loads(run.get("secondary_keywords", "[]"))
            try:
                article, call_info = writer.write_article(
                    run["keyword"], config, brief, nlp_targets, additional,
                    secondary_keywords=secondary_kws,
                )
            except Exception as exc:
                gen_status.update(label="Article generation failed", state="error")
                db.update_step(run_id, STEP_INDEX, status="pending", error=str(exc))
                st.error(f"Article generation failed: {exc}")
                return

            gen_status.update(label=f"Done — {format_cost(call_info)}", state="complete")

            # Save article to disk
            output_dir = pipeline.get_output_dir(run["slug"])
            output_dir.mkdir(parents=True, exist_ok=True)
            article_path = output_dir / "article.mdx"
            article_path.write_text(article, encoding="utf-8")

            # Run local validation
            validation = _run_validation(run["slug"], config)

            step_data["article"] = article
            step_data["article_file"] = str(article_path)
            step_data["validation"] = validation
            step_data["call_info"] = call_info
            save_step_data(run_id, STEP_INDEX, step_data)
            db.update_step(run_id, STEP_INDEX, status="review", error=None)
        st.rerun()

    # ------------------------------------------------------------------
    # REVIEW -- rendered article + validation + approve / edit / redo
    # ------------------------------------------------------------------
    elif status == "review":
        if st.session_state.get(f"wr_edit_mode_{run_id}"):
            _render_edit_mode(run_id, run, step_data, config)
        else:
            _render_article_preview(step_data)

            call_info = step_data.get("call_info")
            if call_info:
                st.caption(f"API: {format_cost(call_info)}")

            _render_validation(step_data.get("validation"))
            st.divider()
            _render_html_output(step_data.get("article", ""), run_id)

            action = approve_controls(f"wr_{run_id}")
            if action == "approve":
                db.update_step(run_id, STEP_INDEX, status="approved")
                st.rerun()
            elif action == "edit":
                st.session_state[f"wr_edit_mode_{run_id}"] = True
                st.rerun()
            elif action == "redo":
                db.update_step(
                    run_id, STEP_INDEX,
                    status="pending", output_json=None, error=None,
                )
                st.rerun()

    # ------------------------------------------------------------------
    # APPROVED
    # ------------------------------------------------------------------
    elif status == "approved":
        article = step_data.get("article", "")
        word_count = len(article.split())
        st.metric("Article Length", f"{word_count} words")

        call_info = step_data.get("call_info")
        if call_info:
            st.caption(f"API: {format_cost(call_info)}")

        with st.expander("View Article", expanded=False):
            st.markdown(article)
        _render_validation(step_data.get("validation"))
        st.divider()
        _render_html_output(article, run_id)
        st.success("Article approved.")

    error_display(step.get("error") if step else None)


# ======================================================================
# Internal helpers
# ======================================================================

def _load_research_brief(run: dict) -> str:
    """Load the research brief from disk."""
    brief_path = pipeline.get_output_dir(run["slug"]) / "research-brief.md"
    if brief_path.exists():
        return brief_path.read_text(encoding="utf-8")
    return ""


def _load_nlp_targets(run: dict) -> dict:
    """Load surfer-targets.json from disk."""
    targets_path = pipeline.get_output_dir(run["slug"]) / "surfer-targets.json"
    if targets_path.exists():
        try:
            return json.loads(targets_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def _run_validation(slug: str, config: dict) -> dict:
    """Run local validation and return the results dict."""
    try:
        config_name = config.get("name", "")
        # Determine config file path
        config_dir = Path(__file__).resolve().parent.parent / "configs"
        config_path = None
        for candidate in config_dir.glob("*.json"):
            if candidate.stem != "_template":
                try:
                    c = json.loads(candidate.read_text(encoding="utf-8"))
                    if c.get("name") == config_name:
                        config_path = str(candidate)
                        break
                except Exception:
                    continue
        return scorer.run_local_validation(slug, config_path)
    except Exception as exc:
        return {"error": str(exc)}


def _render_article_preview(step_data: dict):
    """Render the article markdown in an expander."""
    article = step_data.get("article", "")
    if not article:
        st.warning("No article content.")
        return

    word_count = len(article.split())
    st.metric("Word Count", word_count)

    st.markdown("### Article Preview")
    # Show in a scrollable container
    st.markdown(
        f'<div style="max-height:500px;overflow-y:auto;border:1px solid #ddd;'
        f'padding:16px;border-radius:8px;background:#fafafa;">'
        f'{_md_to_safe_html(article)}</div>',
        unsafe_allow_html=True,
    )


def _md_to_safe_html(md_text: str) -> str:
    """Minimally render markdown for preview. Falls back to st.markdown approach."""
    # We just use the raw markdown in the div -- Streamlit will escape it.
    # For a richer preview, the actual st.markdown call below handles it.
    # This is a fallback container.
    return md_text.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")


def _render_validation(validation: dict | None):
    """Display validation results.

    The ``scorer.run_local_validation`` function returns:
    - ``passed``: bool
    - ``checks``: dict (check_name -> "PASS" | "FAIL (detail)")
    - ``warnings``: list[str]
    - ``failed``: list[str]   (note: key is "failed", not "failures")
    - ``error``: str | None
    """
    if not validation:
        return

    if validation.get("error"):
        st.warning(f"Validation error: {validation['error']}")
        return

    st.markdown("### Validation Results")

    checks = validation.get("checks", {})
    warnings = validation.get("warnings", [])
    failed = validation.get("failed", [])
    passed = validation.get("passed", False)

    pass_count = sum(1 for v in checks.values() if isinstance(v, str) and v.startswith("PASS"))
    fail_count = len(failed)
    warn_count = len(warnings)

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Passed", pass_count)
    with col2:
        st.metric("Warnings", warn_count)
    with col3:
        st.metric("Failures", fail_count)

    if failed:
        st.error("Validation Failures:")
        for f in failed:
            st.markdown(f"- {f}")

    if warnings:
        st.warning("Validation Warnings:")
        for w in warnings:
            st.markdown(f"- {w}")

    if passed and not failed and not warnings:
        st.success("All validation checks passed.")

    json_viewer(validation, label="Full Validation Report")


def _render_html_output(article_md: str, run_id: str):
    """Render article as copyable HTML for pasting into Surfer."""
    import re
    html = scorer.md_to_html(article_md)

    # Word count from HTML text
    text_only = re.sub(r'<[^>]+>', '', html)
    word_count = len(text_only.split())

    st.markdown("### HTML Output for Surfer")
    st.metric("Word Count (HTML)", word_count)

    # Rendered HTML preview — user can select-all + copy
    st.markdown("**Preview (select all + copy to paste into Surfer):**")
    with st.container(height=400):
        st.html(html)

    # Download button
    st.download_button(
        "📥 Download HTML",
        data=html,
        file_name="article.html",
        mime="text/html",
        key=f"download_html_{run_id}",
    )


def _render_edit_mode(run_id: str, run: dict, step_data: dict, config: dict):
    """Show a text area for direct article editing with re-validation."""
    st.markdown("### Edit Article (MDX)")
    edited = st.text_area(
        "Article content",
        value=step_data.get("article", ""),
        height=600,
        key=f"wr_edit_area_{run_id}",
    )

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Save and re-validate", key=f"wr_save_{run_id}", type="primary"):
            step_data["article"] = edited

            # Write to disk
            output_dir = pipeline.get_output_dir(run["slug"])
            article_path = output_dir / "article.mdx"
            article_path.write_text(edited, encoding="utf-8")

            # Re-validate
            validation = _run_validation(run["slug"], config)
            step_data["validation"] = validation

            save_step_data(run_id, STEP_INDEX, step_data)
            st.session_state[f"wr_edit_mode_{run_id}"] = False
            st.rerun()

    with col2:
        if st.button("Cancel", key=f"wr_edit_cancel_{run_id}"):
            st.session_state[f"wr_edit_mode_{run_id}"] = False
            st.rerun()
