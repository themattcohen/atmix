"""Step 0: NLP Input — user provides Surfer SEO NLP terms."""

import json
import streamlit as st
from pathlib import Path

from lib import db, pipeline
from lib.costs import format_cost
from lib.nlp_parser import extract_from_image, extract_from_text
from ui.components import (
    step_header,
    error_display,
    load_step_data,
    save_step_data,
    json_viewer,
)

STEP_INDEX = 0


def render(run_id: str, run: dict):
    """Render the NLP Input step UI.

    Parameters
    ----------
    run_id : str
        Active pipeline run identifier.
    run : dict
        Row from ``db.get_run(run_id)``.
    """
    step = db.get_step(run_id, STEP_INDEX)
    step_info = pipeline.get_step_info(STEP_INDEX)
    status = step["status"] if step else "pending"

    step_header(step_info, status)

    if status in ("pending", "running"):
        _render_input(run_id, run, step)
    elif status == "review":
        _render_review(run_id, run, step)
    elif status == "approved":
        _render_approved(run_id, run, step)

    error_display(step.get("error") if step else None)


# ======================================================================
# Internal helpers
# ======================================================================


def _render_input(run_id: str, run: dict, step: dict):
    """Render the NLP term input interface — screenshot upload or text paste."""
    st.markdown("### Provide NLP terms from Surfer")
    st.info(
        "**Before this step**, you should have:\n"
        "1. Done keyword research in SEMRush\n"
        "2. Created a Surfer Content Editor article for your keyword\n"
        "3. Copied or screenshotted the NLP terms panel from Surfer"
    )

    tab_screenshot, tab_paste = st.tabs(["📸 Screenshot Upload", "📋 Paste Text"])

    with tab_screenshot:
        uploaded = st.file_uploader(
            "Upload Surfer NLP screenshot",
            type=["png", "jpg", "jpeg", "webp"],
            key=f"nlp_screenshot_{run_id}",
        )
        if uploaded and st.button("Extract from Screenshot", key=f"extract_screenshot_{run_id}"):
            with st.status("Extracting NLP terms from image...", expanded=True) as status:
                try:
                    image_bytes = uploaded.read()
                    ext = uploaded.name.rsplit(".", 1)[-1].lower()
                    media_map = {
                        "png": "image/png",
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg",
                        "webp": "image/webp",
                    }
                    media_type = media_map.get(ext, "image/png")

                    db.update_step(run_id, STEP_INDEX, status="running")
                    parsed, call_info = extract_from_image(image_bytes, media_type)
                    status.update(label=f"Done — {format_cost(call_info)}", state="complete")
                    _save_and_review(run_id, parsed, source="screenshot", call_info=call_info)
                    st.rerun()
                except Exception as e:
                    status.update(label="Extraction failed", state="error")
                    db.update_step(run_id, STEP_INDEX, status="pending", error=str(e))
                    error_display(f"Failed to extract terms: {e}")

    with tab_paste:
        pasted = st.text_area(
            "Paste NLP terms from Surfer",
            height=300,
            placeholder="Paste terms here — any format works (tab-separated, dashes, JSON, etc.)",
            key=f"nlp_paste_{run_id}",
        )
        if pasted and st.button("Extract from Text", key=f"extract_text_{run_id}"):
            with st.status("Parsing NLP terms...", expanded=True) as status:
                try:
                    db.update_step(run_id, STEP_INDEX, status="running")
                    parsed, call_info = extract_from_text(pasted)
                    status.update(label=f"Done — {format_cost(call_info)}", state="complete")
                    _save_and_review(run_id, parsed, source="text", call_info=call_info)
                    st.rerun()
                except Exception as e:
                    status.update(label="Parsing failed", state="error")
                    db.update_step(run_id, STEP_INDEX, status="pending", error=str(e))
                    error_display(f"Failed to parse terms: {e}")


def _save_and_review(run_id: str, parsed: dict, source: str, call_info: dict | None = None):
    """Save parsed NLP data and move to review status."""
    data = {
        "parsed": parsed,
        "source": source,
    }
    if call_info:
        data["call_info"] = call_info
    save_step_data(run_id, STEP_INDEX, data)
    db.update_step(run_id, STEP_INDEX, status="review")


def _render_review(run_id: str, run: dict, step: dict):
    """Render the review interface with editable terms table."""
    step_data = load_step_data(step)
    parsed = step_data.get("parsed", {})
    terms_dict = parsed.get("terms", {})
    targets = parsed.get("targets", {})

    # Flatten terms for editing
    flat_terms = []
    for priority in ("high_priority", "medium_priority", "low_priority"):
        for t in terms_dict.get(priority, []):
            flat_terms.append({
                "term": t["term"],
                "priority": priority.replace("_priority", ""),
                "targetMin": t.get("targetMin", 1),
                "targetMax": t.get("targetMax", 3),
                "include": True,
            })

    st.markdown(f"### Extracted {len(flat_terms)} NLP terms")

    call_info = step_data.get("call_info")
    if call_info:
        st.caption(f"API: {format_cost(call_info)}")

    # Target overrides
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        wc_min = st.number_input(
            "Word count min",
            value=targets.get("wordCount", {}).get("min", 1500),
            min_value=500,
            step=100,
            key=f"wc_min_{run_id}",
        )
    with col2:
        wc_max = st.number_input(
            "Word count max",
            value=targets.get("wordCount", {}).get("max", 2500),
            min_value=500,
            step=100,
            key=f"wc_max_{run_id}",
        )
    with col3:
        h_min = st.number_input(
            "Headings min",
            value=targets.get("headings", {}).get("min", 5),
            min_value=1,
            step=1,
            key=f"h_min_{run_id}",
        )
    with col4:
        h_max = st.number_input(
            "Headings max",
            value=targets.get("headings", {}).get("max", 12),
            min_value=1,
            step=1,
            key=f"h_max_{run_id}",
        )

    # Editable terms table
    import pandas as pd

    df = pd.DataFrame(flat_terms)
    if not df.empty:
        edited_df = st.data_editor(
            df,
            column_config={
                "term": st.column_config.TextColumn("Term", width="large"),
                "priority": st.column_config.SelectboxColumn(
                    "Priority", options=["high", "medium", "low"], width="small"
                ),
                "targetMin": st.column_config.NumberColumn(
                    "Min", min_value=0, max_value=50, width="small"
                ),
                "targetMax": st.column_config.NumberColumn(
                    "Max", min_value=0, max_value=50, width="small"
                ),
                "include": st.column_config.CheckboxColumn("Include", width="small"),
            },
            use_container_width=True,
            num_rows="dynamic",
            key=f"nlp_editor_{run_id}",
        )
    else:
        edited_df = df
        st.warning("No terms extracted. You can add terms manually using the table.")

    # Approve / Redo controls
    col_approve, col_redo = st.columns(2)
    with col_approve:
        if st.button("✅ Save & Continue", key=f"nlp_approve_{run_id}", type="primary"):
            _approve(run_id, run, edited_df, wc_min, wc_max, h_min, h_max, step_data)
            st.rerun()
    with col_redo:
        if st.button("🔄 Re-extract", key=f"nlp_redo_{run_id}"):
            db.update_step(run_id, STEP_INDEX, status="pending", output_json=None)
            st.rerun()

    # Raw JSON viewer
    json_viewer(parsed, "Raw extracted data")


def _approve(run_id: str, run: dict, edited_df, wc_min, wc_max, h_min, h_max, prev_step_data: dict | None = None):
    """Save approved terms to surfer-targets.json and advance step."""
    # Filter to included terms only and rebuild priority buckets
    if not edited_df.empty:
        included = edited_df[edited_df["include"] == True]  # noqa: E712
        terms_by_priority = {
            "high_priority": [],
            "medium_priority": [],
            "low_priority": [],
        }
        for _, row in included.iterrows():
            entry = {
                "term": row["term"],
                "targetMin": int(row["targetMin"]),
                "targetMax": int(row["targetMax"]),
            }
            bucket = f"{row['priority']}_priority"
            if bucket in terms_by_priority:
                terms_by_priority[bucket].append(entry)
            else:
                terms_by_priority["medium_priority"].append(entry)
    else:
        terms_by_priority = {
            "high_priority": [],
            "medium_priority": [],
            "low_priority": [],
        }

    final = {
        "targets": {
            "wordCount": {"min": int(wc_min), "max": int(wc_max)},
            "headings": {"min": int(h_min), "max": int(h_max)},
        },
        "terms": terms_by_priority,
    }

    # Save to disk
    output_dir = pipeline.get_output_dir(run["slug"])
    targets_path = Path(output_dir) / "surfer-targets.json"
    targets_path.write_text(json.dumps(final, indent=2), encoding="utf-8")

    # Save to DB and advance
    total = sum(len(v) for v in terms_by_priority.values())
    data = {"nlp_targets": final, "term_count": total}
    # Preserve call_info from the extraction phase
    if prev_step_data and prev_step_data.get("call_info"):
        data["call_info"] = prev_step_data["call_info"]
    save_step_data(run_id, STEP_INDEX, data)
    db.update_step(run_id, STEP_INDEX, status="approved")


def _render_approved(run_id: str, run: dict, step: dict):
    """Show approved NLP targets summary."""
    step_data = load_step_data(step)
    nlp = step_data.get("nlp_targets", {})
    terms = nlp.get("terms", {})
    targets = nlp.get("targets", {})

    total = sum(len(v) for v in terms.values())

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("NLP Terms", total)
    with col2:
        wc = targets.get("wordCount", {})
        st.metric("Word Count", f"{wc.get('min', '?')}–{wc.get('max', '?')}")
    with col3:
        h = targets.get("headings", {})
        st.metric("Headings", f"{h.get('min', '?')}–{h.get('max', '?')}")

    call_info = step_data.get("call_info")
    if call_info:
        st.caption(f"API: {format_cost(call_info)}")

    st.success("NLP targets approved and saved.")

    with st.expander("View NLP targets"):
        json_viewer(nlp, "surfer-targets.json")
