"""UI for Step 2 -- Research Brief generation (Claude)."""

import json
import streamlit as st
from pathlib import Path

from lib import db, pipeline, writer
from ui.components import (
    step_header,
    approve_controls,
    error_display,
    load_step_data,
    save_step_data,
)

STEP_INDEX = 2


def render(run_id: str, run: dict, config: dict):
    """Render the research brief generation step.

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
    step_data = load_step_data(step)

    step_header(step_info, status)

    # ------------------------------------------------------------------
    # PENDING -- generate button
    # ------------------------------------------------------------------
    if status == "pending":
        st.info(f'Keyword: **{run["keyword"]}**')
        secondary_kws = json.loads(run.get("secondary_keywords", "[]"))
        if secondary_kws:
            st.info(f'Secondary: {", ".join(secondary_kws)}')

        extra_notes = st.text_area(
            "Additional notes / sources for the research brief (optional)",
            value="",
            height=100,
            key=f"res_notes_{run_id}",
        )

        if st.button("Generate Research Brief", key=f"res_gen_{run_id}"):
            db.update_step(run_id, STEP_INDEX, status="running")
            st.rerun()

    # ------------------------------------------------------------------
    # RUNNING -- spinner + actual generation
    # ------------------------------------------------------------------
    elif status == "running":
        extra_notes = st.session_state.get(f"res_notes_{run_id}", "")
        secondary_kws = json.loads(run.get("secondary_keywords", "[]"))
        with st.spinner("Claude is generating the research brief..."):
            try:
                brief = writer.generate_research_brief(run["keyword"], config, secondary_kws)
            except Exception as exc:
                db.update_step(run_id, STEP_INDEX, status="pending", error=str(exc))
                st.error(f"Generation failed: {exc}")
                return

            # Append extra notes if provided
            if extra_notes.strip():
                brief += f"\n\n---\n\n## Additional Notes\n\n{extra_notes.strip()}"

            # Save to file
            output_dir = pipeline.get_output_dir(run["slug"])
            output_dir.mkdir(parents=True, exist_ok=True)
            brief_path = output_dir / "research-brief.md"
            brief_path.write_text(brief, encoding="utf-8")

            # Persist in step
            step_data["brief"] = brief
            step_data["brief_file"] = str(brief_path)
            save_step_data(run_id, STEP_INDEX, step_data)
            db.update_step(run_id, STEP_INDEX, status="review", error=None)
        st.rerun()

    # ------------------------------------------------------------------
    # REVIEW -- show brief + approve / edit / redo
    # ------------------------------------------------------------------
    elif status == "review":
        brief_text = step_data.get("brief", "")

        # Check for edit mode
        if st.session_state.get(f"res_edit_mode_{run_id}"):
            _render_edit_mode(run_id, run, step_data)
        else:
            st.markdown("### Research Brief Preview")
            st.markdown(brief_text)

            action = approve_controls(f"res_{run_id}")
            if action == "approve":
                db.update_step(run_id, STEP_INDEX, status="approved")
                st.rerun()
            elif action == "edit":
                st.session_state[f"res_edit_mode_{run_id}"] = True
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
        brief_text = step_data.get("brief", "")
        word_count = len(brief_text.split())
        st.metric("Brief Length", f"{word_count} words")
        with st.expander("View Research Brief", expanded=False):
            st.markdown(brief_text)
        st.success("Research brief approved.")

    # Error
    error_display(step.get("error") if step else None)


# ======================================================================
# Internal helpers
# ======================================================================

def _render_edit_mode(run_id: str, run: dict, step_data: dict):
    """Allow the user to edit the research brief in a text area."""
    st.markdown("### Edit Research Brief")
    edited = st.text_area(
        "Research Brief (Markdown)",
        value=step_data.get("brief", ""),
        height=500,
        key=f"res_edit_area_{run_id}",
    )

    col1, col2 = st.columns(2)
    with col1:
        if st.button("Save edits", key=f"res_save_{run_id}", type="primary"):
            step_data["brief"] = edited

            # Overwrite file on disk
            output_dir = pipeline.get_output_dir(run["slug"])
            brief_path = output_dir / "research-brief.md"
            brief_path.write_text(edited, encoding="utf-8")

            save_step_data(run_id, STEP_INDEX, step_data)
            st.session_state[f"res_edit_mode_{run_id}"] = False
            st.rerun()

    with col2:
        if st.button("Cancel", key=f"res_edit_cancel_{run_id}"):
            st.session_state[f"res_edit_mode_{run_id}"] = False
            st.rerun()
