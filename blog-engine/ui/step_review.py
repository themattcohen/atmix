"""Step 3: Review & Iterate — user provides feedback, Claude rewrites."""

import json
import re
import streamlit as st
from pathlib import Path

from lib import db, pipeline, writer, scorer
from lib.costs import format_cost
from lib.imagen import generate_hero_images, select_hero_image
from lib.nlp_parser import extract_score_overview, extract_entities_with_counts, extract_heading_counts
from lib.gap_analysis import build_surfer_feedback
from ui.components import (
    step_header,
    error_display,
    load_step_data,
    save_step_data,
    json_viewer,
    run_async,
)

STEP_INDEX = 3


def render(run_id: str, run: dict, config: dict):
    """Render the Review & Iterate step UI.

    Parameters
    ----------
    run_id : str
        Active pipeline run identifier.
    run : dict
        Row from ``db.get_run(run_id)``.
    config : dict
        Loaded pipeline configuration (e.g. ``tax-general.json``).
    """
    step = db.get_step(run_id, STEP_INDEX)
    step_info = pipeline.get_step_info(STEP_INDEX)
    status = step["status"] if step else "pending"

    step_header(step_info, status)

    if status in ("pending", "review"):
        _render_review_loop(run_id, run, config, step)
    elif status == "approved":
        _render_approved(run_id, run, step, config)

    error_display(step.get("error") if step else None)


# ======================================================================
# Internal helpers
# ======================================================================


def _render_review_loop(run_id: str, run: dict, config: dict, step: dict):
    """Render the feedback/rewrite loop."""
    step_data = load_step_data(step) or {}
    iteration = step_data.get("iteration", 1)

    # Load current article
    output_dir = pipeline.get_output_dir(run["slug"])
    article_path = Path(output_dir) / "article.mdx"

    if not article_path.exists():
        st.error("No article found. Complete the Write step first.")
        return

    article_md = article_path.read_text(encoding="utf-8")

    st.markdown(f"### Article Review — Version {iteration}")

    # Show article as copyable HTML
    _render_html_output(article_md, run_id)

    st.divider()

    # Surfer screenshot upload
    with st.expander("Upload Surfer Screenshots for Analysis", expanded=False):
        st.caption(
            "Upload screenshots from Surfer's Content Editor to auto-generate "
            "structured feedback with specific gaps."
        )
        ss_col1, ss_col2, ss_col3 = st.columns(3)
        with ss_col1:
            ss_overview = st.file_uploader(
                "Score Overview",
                type=["png", "jpg", "jpeg", "webp"],
                key=f"ss_overview_v{iteration}_{run_id}",
                help="Screenshot of the Surfer metrics bar (score, word count, headings)",
            )
        with ss_col2:
            ss_entities = st.file_uploader(
                "Entities Panel",
                type=["png", "jpg", "jpeg", "webp"],
                key=f"ss_entities_v{iteration}_{run_id}",
                help="Screenshot of the NLP entities list with current/target counts",
            )
        with ss_col3:
            ss_headings = st.file_uploader(
                "Headings Panel",
                type=["png", "jpg", "jpeg", "webp"],
                key=f"ss_headings_v{iteration}_{run_id}",
                help="Screenshot of the headings terms list",
            )

        if (ss_overview or ss_entities or ss_headings) and st.button(
            "🔍 Analyze Screenshots",
            key=f"analyze_ss_v{iteration}_{run_id}",
            type="primary",
        ):
            _analyze_surfer_screenshots(
                run_id, run, iteration, step_data,
                ss_overview, ss_entities, ss_headings,
            )
            st.rerun()

    # Feedback input
    st.markdown("### Provide Feedback")
    st.info(
        "Paste your article HTML into Surfer's Content Editor, then report back:\n"
        "- Surfer content score\n"
        "- Missing or underused NLP terms\n"
        "- Any other feedback or changes needed\n\n"
        "Or use the screenshot uploader above to auto-generate structured feedback."
    )

    feedback_key = f"feedback_v{iteration}_{run_id}"
    feedback = st.text_area(
        "Feedback for rewrite",
        height=200,
        placeholder=(
            "e.g., Score: 72/90. Missing terms: fbar penalty (need 3 more), "
            "filing deadline (need 2 more). Also, the intro is too long."
        ),
        key=feedback_key,
    )

    col1, col2, col3 = st.columns(3)

    with col1:
        if feedback and st.button(
            "🔄 Rewrite with Feedback",
            key=f"rewrite_v{iteration}_{run_id}",
            type="primary",
        ):
            _do_rewrite(run_id, run, config, article_md, feedback, iteration, step_data)
            st.rerun()

    with col2:
        if st.button("✅ Approve Final", key=f"approve_v{iteration}_{run_id}"):
            _approve_final(run_id, run, step_data, iteration)
            st.rerun()

    with col3:
        if st.button("🖼️ Generate Hero Image", key=f"hero_v{iteration}_{run_id}"):
            _generate_hero(run_id, run, config, step_data)
            st.rerun()

    # Show final hero if already selected
    hero_path = Path(output_dir) / "hero.webp"
    if hero_path.exists():
        st.markdown("### Hero Image")
        st.image(str(hero_path), use_container_width=True)
    else:
        # Show hero candidate options if generated but not yet selected
        _show_hero_options(run_id, run, config, step_data)

    # Show cost summary if any
    cost_history = step_data.get("cost_history", [])
    if cost_history:
        for i, ci in enumerate(cost_history):
            st.caption(f"Rewrite {i + 1}: {format_cost(ci)}")

    analysis_cost_history = step_data.get("analysis_cost_history", [])
    if analysis_cost_history:
        for i, ci in enumerate(analysis_cost_history):
            st.caption(f"Screenshot analysis {i + 1}: {format_cost(ci)}")

    hero_cost = step_data.get("hero_cost")
    if hero_cost:
        st.caption(f"Hero images: {format_cost(hero_cost)}")

    # Show iteration history if any
    history = step_data.get("history", [])
    if history:
        with st.expander(f"Feedback history ({len(history)} rounds)"):
            for entry in history:
                st.markdown(f"**Version {entry['version']}** feedback:")
                st.text(entry["feedback"])
                st.divider()


def _render_html_output(article_md: str, run_id: str):
    """Render article as copyable HTML for pasting into Surfer."""
    html = scorer.md_to_html(article_md)

    # Word count estimate (strip tags)
    text_only = re.sub(r"<[^>]+>", "", html)
    word_count = len(text_only.split())

    st.metric("Word Count", word_count)

    st.markdown("**Copy this HTML into Surfer's Content Editor:**")
    with st.container(height=500):
        st.html(html)

    st.download_button(
        "📥 Download HTML",
        data=html,
        file_name="article.html",
        mime="text/html",
        key=f"download_html_review_{run_id}",
    )


def _analyze_surfer_screenshots(
    run_id: str,
    run: dict,
    iteration: int,
    step_data: dict,
    ss_overview,
    ss_entities,
    ss_headings,
):
    """Parse Surfer screenshots and generate structured feedback text."""
    with st.status("Analyzing Surfer screenshots...", expanded=True) as status:
        try:
            analysis_costs: list[dict] = []
            score_overview = None
            entities_with_counts = None
            heading_counts = None

            if ss_overview is not None:
                img_bytes = ss_overview.read()
                media_type = _mime_from_name(ss_overview.name)
                score_overview, ci = extract_score_overview(img_bytes, media_type)
                analysis_costs.append(ci)
                st.write(f"Score overview parsed: {format_cost(ci)}")

            if ss_entities is not None:
                img_bytes = ss_entities.read()
                media_type = _mime_from_name(ss_entities.name)
                entities_with_counts, ci = extract_entities_with_counts(img_bytes, media_type)
                analysis_costs.append(ci)
                st.write(f"Entities parsed ({len(entities_with_counts)} terms): {format_cost(ci)}")

            if ss_headings is not None:
                img_bytes = ss_headings.read()
                media_type = _mime_from_name(ss_headings.name)
                heading_counts, ci = extract_heading_counts(img_bytes, media_type)
                analysis_costs.append(ci)
                st.write(f"Headings parsed ({len(heading_counts)} terms): {format_cost(ci)}")

            # Load surfer-targets.json
            output_dir = pipeline.get_output_dir(run["slug"])
            targets_path = Path(output_dir) / "surfer-targets.json"
            if targets_path.exists():
                surfer_targets = json.loads(targets_path.read_text(encoding="utf-8"))
            else:
                surfer_targets = {"terms": {}, "targets": {}}

            # Build structured feedback
            feedback_text = build_surfer_feedback(
                score_overview, entities_with_counts, heading_counts, surfer_targets,
            )

            # Pre-populate the feedback text_area via its session state key
            feedback_widget_key = f"feedback_v{iteration}_{run_id}"
            st.session_state[feedback_widget_key] = feedback_text

            # Persist analysis costs
            existing_analysis_costs = step_data.get("analysis_cost_history", [])
            step_data["analysis_cost_history"] = existing_analysis_costs + analysis_costs
            save_step_data(run_id, STEP_INDEX, step_data)

            total_cost = sum(c.get("cost_usd", 0) for c in analysis_costs)
            status.update(
                label=f"Analysis complete — ${total_cost:.3f}",
                state="complete",
            )
        except Exception as exc:
            status.update(label="Screenshot analysis failed", state="error")
            st.error(f"Screenshot analysis failed: {exc}")


def _mime_from_name(filename: str) -> str:
    """Infer MIME type from file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "png"
    return {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }.get(ext, "image/png")


def _do_rewrite(
    run_id: str,
    run: dict,
    config: dict,
    article_md: str,
    feedback: str,
    iteration: int,
    step_data: dict,
):
    """Run Claude rewrite with feedback."""
    with st.status(f"Rewriting article (v{iteration + 1})...", expanded=True) as rw_status:
        try:
            # Load NLP targets
            output_dir = pipeline.get_output_dir(run["slug"])
            targets_path = Path(output_dir) / "surfer-targets.json"
            nlp_targets = None
            if targets_path.exists():
                nlp_targets = json.loads(targets_path.read_text(encoding="utf-8"))

            # Rewrite via Claude
            new_article, call_info = writer.rewrite_with_feedback(
                article=article_md,
                feedback=feedback,
                nlp_targets=nlp_targets,
                config=config,
                keyword=run["keyword"],
            )

            rw_status.update(label=f"Done — {format_cost(call_info)}", state="complete")

            # Save new version to disk
            article_path = Path(output_dir) / "article.mdx"
            article_path.write_text(new_article, encoding="utf-8")

            # Update step data
            new_iteration = iteration + 1
            history = step_data.get("history", [])
            history.append({"version": iteration, "feedback": feedback})

            new_data = {
                "iteration": new_iteration,
                "history": history,
                "cost_history": step_data.get("cost_history", []) + [call_info],
            }
            # Preserve hero image data if present
            if "hero_options" in step_data:
                new_data["hero_options"] = step_data["hero_options"]
            if "hero_selected" in step_data:
                new_data["hero_selected"] = step_data["hero_selected"]
            if "hero_cost" in step_data:
                new_data["hero_cost"] = step_data["hero_cost"]

            save_step_data(run_id, STEP_INDEX, new_data)
            db.update_step(run_id, STEP_INDEX, status="review", error=None)
        except Exception as exc:
            rw_status.update(label="Rewrite failed", state="error")
            db.update_step(run_id, STEP_INDEX, error=str(exc))
            error_display(f"Rewrite failed: {exc}")


def _approve_final(run_id: str, run: dict, step_data: dict, iteration: int):
    """Approve the final article and complete the run."""
    final_data = dict(step_data)
    final_data["iteration"] = iteration
    final_data["final"] = True
    save_step_data(run_id, STEP_INDEX, final_data)
    db.update_step(run_id, STEP_INDEX, status="approved", error=None)
    pipeline.advance_step(run_id)


def _generate_hero(run_id: str, run: dict, config: dict, step_data: dict):
    """Generate hero images using Imagen."""
    output_dir = pipeline.get_output_dir(run["slug"])
    article_path = Path(output_dir) / "article.mdx"

    if not article_path.exists():
        st.error("No article found.")
        return

    title, description = _read_article_frontmatter(article_path)
    hero_config = config.get("heroImage", {})

    if not hero_config:
        st.warning("No heroImage config found in niche config. Using defaults.")
        hero_config = {
            "style": "modern minimalist illustration",
            "colorScheme": "professional blue and white",
        }

    with st.status("Generating hero images...", expanded=True) as hero_status:
        try:
            paths, call_info = run_async(
                generate_hero_images(title, description, hero_config, output_dir, count=3)
            )
            hero_status.update(label=f"Done — {format_cost(call_info)}", state="complete")
            new_data = dict(step_data)
            new_data["hero_options"] = paths
            new_data["hero_cost"] = call_info
            save_step_data(run_id, STEP_INDEX, new_data)
        except Exception as e:
            hero_status.update(label="Hero image generation failed", state="error")
            error_display(f"Hero image generation failed: {e}")


def _show_hero_options(run_id: str, run: dict, config: dict, step_data: dict):
    """Show generated hero image options for selection."""
    options = step_data.get("hero_options", [])
    if not options:
        return

    # Filter to existing files
    existing = [p for p in options if Path(p).exists()]
    if not existing:
        return

    st.markdown("### Hero Image Options")
    cols = st.columns(min(len(existing), 4))
    for i, path in enumerate(existing):
        with cols[i % len(cols)]:
            st.image(path, use_container_width=True)
            if st.button(f"Select #{i + 1}", key=f"select_hero_{i}_{run_id}"):
                output_dir = pipeline.get_output_dir(run["slug"])
                final = select_hero_image(path, output_dir)
                new_data = dict(step_data)
                new_data["hero_selected"] = final
                save_step_data(run_id, STEP_INDEX, new_data)
                st.rerun()


def _read_article_frontmatter(article_path: Path) -> tuple[str, str]:
    """Parse title and description from article MDX frontmatter."""
    content = article_path.read_text(encoding="utf-8")
    title = ""
    description = ""

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            for line in frontmatter.strip().split("\n"):
                if line.startswith("title:"):
                    title = line.split(":", 1)[1].strip().strip("'\"")
                elif line.startswith("description:"):
                    description = line.split(":", 1)[1].strip().strip("'\"")

    return title or "Untitled", description or ""


def _render_approved(run_id: str, run: dict, step: dict, config: dict):
    """Show the approved final article and hero image."""
    step_data = load_step_data(step) or {}
    iteration = step_data.get("iteration", 1)
    output_dir = pipeline.get_output_dir(run["slug"])

    st.success(f"Article approved (version {iteration}). Run complete!")

    # Show accumulated costs
    cost_history = step_data.get("cost_history", [])
    if cost_history:
        for i, ci in enumerate(cost_history):
            st.caption(f"Rewrite {i + 1}: {format_cost(ci)}")

    hero_cost = step_data.get("hero_cost")
    if hero_cost:
        st.caption(f"Hero images: {format_cost(hero_cost)}")

    # Show final article HTML
    article_path = Path(output_dir) / "article.mdx"
    if article_path.exists():
        article_md = article_path.read_text(encoding="utf-8")
        _render_html_output(article_md, run_id)

    # Show hero image
    hero_path = Path(output_dir) / "hero.webp"
    if hero_path.exists():
        st.markdown("### Hero Image")
        st.image(str(hero_path), use_container_width=True)

    # Output files summary
    st.markdown("### Output Files")
    output_path = Path(output_dir)
    for f in sorted(output_path.iterdir()):
        if f.is_file():
            st.text(f"  {f.name}")
