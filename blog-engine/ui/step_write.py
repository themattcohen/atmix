"""UI for Step 2 -- Article Writing (Claude + local validation)."""

import base64
import json
import logging
import re
import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path

from lib import db, pipeline, writer, scorer
from lib.auto_review import analyze_article_against_targets
from lib.gap_analysis import build_surfer_feedback
from lib.costs import format_cost
from ui.components import (
    step_header,
    error_display,
    json_viewer,
    load_step_data,
    save_step_data,
)

logger = logging.getLogger("blog-engine.step_write")

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
                    slug=run["slug"],
                )
            except Exception as exc:
                gen_status.update(label="Article generation failed", state="error")
                db.update_step(run_id, STEP_INDEX, status="pending", error=str(exc))
                st.error(f"Article generation failed: {exc}")
                return

            if call_info.get("truncated"):
                st.warning("⚠️ Article was truncated — the model hit the token limit. Consider splitting the article or reducing the target word count.")
            gen_status.update(label=f"Written — {format_cost(call_info)}", state="running")

            # Save initial draft to disk
            output_dir = pipeline.get_output_dir(run["slug"])
            output_dir.mkdir(parents=True, exist_ok=True)
            article_path = output_dir / "article.mdx"
            article_path.write_text(article, encoding="utf-8")

            # --- Auto-optimize against NLP targets ---
            opt_call_info = None
            auto_review = None
            if nlp_targets:
                try:
                    gen_status.update(label="Auto-optimizing against NLP targets...", state="running")

                    # Load AI facts from Step 0
                    step0 = db.get_step(run_id, 0)
                    step0_data = load_step_data(step0)
                    ai_facts = step0_data.get("ai_facts", [])

                    analysis = analyze_article_against_targets(article, nlp_targets, ai_facts=ai_facts)
                    feedback = build_surfer_feedback(
                        analysis["score_overview"],
                        analysis["entities_with_counts"],
                        analysis["heading_counts"],
                        nlp_targets,
                        ai_optimization=analysis.get("ai_optimization"),
                    )

                    if feedback and feedback != "No gaps detected from screenshots. Review manually.":
                        optimized, opt_call_info = writer.rewrite_with_feedback(
                            article=article,
                            feedback=feedback,
                            nlp_targets=nlp_targets,
                            config=config,
                            keyword=run["keyword"],
                            slug=run["slug"],
                        )
                        if opt_call_info.get("truncated"):
                            st.warning("⚠️ Optimized article was truncated — the model hit the token limit.")
                        article = optimized
                        article_path.write_text(article, encoding="utf-8")

                    auto_review = {
                        "feedback": feedback,
                        "word_count": analysis["word_count"],
                        "heading_count": analysis["heading_count"],
                        "underused_count": sum(
                            1 for e in analysis["entities_with_counts"]
                            if e["current"] < e["targetMin"]
                        ),
                    }
                except Exception as exc:
                    logger.warning("Auto-optimize failed: %s", exc)
                    st.warning(f"Auto-optimization skipped: {exc}")

            cost_label = f"Done — Write: {format_cost(call_info)}"
            if opt_call_info:
                cost_label += f" + Optimize: {format_cost(opt_call_info)}"
            gen_status.update(label=cost_label, state="complete")

            # Run local validation
            validation = _run_validation(run["slug"], config)

            step_data["article"] = article
            step_data["article_file"] = str(article_path)
            step_data["validation"] = validation
            step_data["call_info"] = call_info
            step_data["opt_call_info"] = opt_call_info
            step_data["auto_review"] = auto_review
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
            opt_call_info = step_data.get("opt_call_info")
            if call_info:
                cost_label = f"Write: {format_cost(call_info)}"
                if opt_call_info:
                    cost_label += f" + Optimize: {format_cost(opt_call_info)}"
                st.caption(cost_label)

            auto_review = step_data.get("auto_review")
            if auto_review:
                with st.expander("Auto-Optimization Summary", expanded=False):
                    st.markdown(auto_review["feedback"])

            _render_validation(step_data.get("validation"))
            _show_title_similarity_warning(step_data.get("article", ""), run)
            st.divider()
            _render_html_output(step_data.get("article", ""), run_id)

            col1, col2, col3 = st.columns(3)
            with col1:
                if st.button("Continue to Review →", key=f"wr_continue_{run_id}", type="primary"):
                    db.update_step(run_id, STEP_INDEX, status="approved")
                    pipeline.advance_step(run_id)
                    st.rerun()
            with col2:
                if st.button("Edit", key=f"wr_edit_{run_id}"):
                    st.session_state[f"wr_edit_mode_{run_id}"] = True
                    st.rerun()
            with col3:
                if st.button("Redo", key=f"wr_redo_{run_id}"):
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
        opt_call_info = step_data.get("opt_call_info")
        if call_info:
            cost_label = f"Write: {format_cost(call_info)}"
            if opt_call_info:
                cost_label += f" + Optimize: {format_cost(opt_call_info)}"
            st.caption(cost_label)

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


def _clipboard_button(text: str, label: str = "Copy Article to Clipboard"):
    """Render a one-click clipboard copy button using an HTML component."""
    b64 = base64.b64encode(text.encode()).decode()
    components.html(f"""
    <button id="cpBtn" onclick="
        const bytes = Uint8Array.from(atob('{b64}'), c => c.charCodeAt(0));
        navigator.clipboard.writeText(new TextDecoder().decode(bytes)).then(() => {{
            this.innerText = '\u2713 Copied!';
            setTimeout(() => this.innerText = '\U0001f4cb {label}', 2000);
        }}).catch(() => {{
            this.innerText = 'Copy failed \u2014 use download';
            setTimeout(() => this.innerText = '\U0001f4cb {label}', 3000);
        }})
    " style="padding:8px 16px;border:1px solid #ccc;border-radius:6px;
             background:#f8f8f8;cursor:pointer;font-size:14px;">
        \U0001f4cb {label}
    </button>
    """, height=50)


def _render_html_output(article_md: str, run_id: str):
    """Render article as copyable HTML for pasting into Surfer."""
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

    _clipboard_button(article_md)


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


def _show_title_similarity_warning(article: str, run: dict):
    """Check if the article's H1 is similar to existing titles and show a warning."""
    if not article:
        return

    # Extract H1 from article
    h1_match = re.search(r"^# (.+)$", article, re.MULTILINE)
    if not h1_match:
        return
    h1_title = h1_match.group(1).strip()

    # Load existing articles from crosslinks.json
    from lib.crosslinks import check_title_similarity

    output_dir = pipeline.get_output_dir(run["slug"])
    crosslinks_path = output_dir / "crosslinks.json"
    if not crosslinks_path.exists():
        return

    try:
        existing = json.loads(crosslinks_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, TypeError):
        return

    matches = check_title_similarity(h1_title, existing)
    if matches:
        lines = [f"**\"{h1_title}\"** may overlap with existing articles:"]
        for m in matches:
            pct = int(m["similarity"] * 100)
            lines.append(f"- **{m['title']}** — {pct}% similar ({m['type']})")
        st.warning("⚠️ Similar existing titles detected\n\n" + "\n".join(lines))
