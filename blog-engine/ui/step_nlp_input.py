"""Step 0: NLP Input — user provides Surfer SEO NLP terms."""

import json
import logging
import re
import streamlit as st
from pathlib import Path

import pandas as pd

from lib import db, pipeline
from lib.costs import format_cost, sum_costs
from lib.nlp_parser import extract_from_text, extract_ai_facts, verify_extraction_with_image, categorize_terms

try:
    from lib.ocr_parser import extract_with_ocr, sanity_check_targets
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

from ui.components import (
    step_header,
    error_display,
    load_step_data,
    save_step_data,
    json_viewer,
)

logger = logging.getLogger("blog-engine.step_nlp_input")

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
# Small helpers
# ======================================================================


def _media_type(ext: str) -> str:
    """Map file extension to MIME type."""
    return {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "image/png")


def _merge_terms(dest: dict, terms: dict):
    """Merge categorized terms into *dest* (keyed by lowercase term).

    Keeps highest targetMax and lowest targetMin on collision.
    """
    for priority in ("high_priority", "medium_priority", "low_priority"):
        for t in terms.get(priority, []):
            key = t["term"].lower().strip()
            if key in dest:
                existing = dest[key]
                existing["targetMax"] = max(existing["targetMax"], t.get("targetMax", 0))
                existing["targetMin"] = min(existing["targetMin"], t.get("targetMin", 0))
            else:
                dest[key] = {
                    "term": t["term"],
                    "targetMin": t.get("targetMin", 1),
                    "targetMax": t.get("targetMax", 3),
                }


def _merge_targets_dict(dest: dict, src: dict):
    """Merge target sub-dicts — first non-None wins."""
    for key in ("wordCount", "headings"):
        if key not in dest and key in src:
            dest[key] = src[key]


def _count_terms(terms: dict) -> int:
    """Count total terms across priority buckets."""
    return sum(len(terms.get(p, [])) for p in ("high_priority", "medium_priority", "low_priority"))


def _combine_editors(high_df, medium_df, low_df, heading_df):
    """Merge per-bucket DataFrames back into a single DataFrame for ``_approve()``."""
    frames = []
    for df, priority in [(high_df, "high"), (medium_df, "medium"), (low_df, "low"), (heading_df, "heading")]:
        if df is not None and not df.empty:
            sub = df.copy()
            sub["priority"] = priority
            frames.append(sub)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=["term", "priority", "targetMin", "targetMax", "include"])


# ======================================================================
# Input — slot-based layout
# ======================================================================


def _render_input(run_id: str, run: dict, step: dict):
    """Render slot-based NLP input form — screenshots + pasted text."""
    st.markdown("### Provide NLP terms from Surfer")
    st.info(
        "Upload screenshots and/or paste the **Copy all SEO entities** text from Surfer.\n"
        "Provide at least **Slot 1** (screenshot) or **Slot 3** (pasted text)."
    )

    # Slot 1 — Keywords & Targets screenshot
    st.markdown("#### 1. Keywords & Targets Screenshot")
    slot1_help = (
        "Tesseract not installed — screenshot processing unavailable"
        if not HAS_OCR
        else "Screenshot of Surfer's NLP entities panel with metrics bar"
    )
    slot1_file = st.file_uploader(
        "Upload NLP entities screenshot",
        type=["png", "jpg", "jpeg", "webp"],
        key=f"slot1_{run_id}",
        disabled=not HAS_OCR,
        help=slot1_help,
    )

    # Slot 2 — Headings tab screenshot (optional)
    st.markdown("#### 2. Headings Tab Screenshot *(optional)*")
    slot2_file = st.file_uploader(
        "Upload Surfer Headings tab screenshot",
        type=["png", "jpg", "jpeg", "webp"],
        key=f"slot2_{run_id}",
        disabled=not HAS_OCR,
        help="Screenshot of Surfer's Headings tab",
    )

    # Slot 3 — Copy all SEO entities paste
    st.markdown("#### 3. Copy All SEO Entities *(optional)*")
    slot3_text = st.text_area(
        "Paste text from Surfer's 'Copy all SEO entities' button",
        height=200,
        placeholder="Click 'Copy all SEO entities' in Surfer and paste here...",
        key=f"slot3_{run_id}",
    )

    # Slot 4 — AI SEO Facts
    st.markdown("#### 4. AI SEO Facts")
    slot4_text = st.text_area(
        "Paste AI SEO facts",
        height=150,
        placeholder="Paste facts from Surfer's 'Optimize for AI Search' panel...",
        key=f"slot4_text_{run_id}",
    )
    slot4_file = st.file_uploader(
        "Or upload AI SEO screenshot",
        type=["png", "jpg", "jpeg", "webp"],
        key=f"slot4_file_{run_id}",
    )

    # Show existing AI facts if already stored
    step_data = load_step_data(step)
    existing_facts = step_data.get("ai_facts", [])
    if existing_facts:
        st.caption(f"{len(existing_facts)} AI SEO facts already loaded from previous extraction")

    # Process button
    can_process = bool(slot1_file or slot3_text)
    if st.button("Process", disabled=not can_process, type="primary", key=f"process_{run_id}"):
        _process_all_inputs(run_id, run, step, slot1_file, slot2_file, slot3_text, slot4_text, slot4_file)
        st.rerun()

    if not can_process:
        st.caption("Provide at least a screenshot (Slot 1) or pasted text (Slot 3) to enable processing.")


# ======================================================================
# Processing — orchestration pipeline
# ======================================================================


def _process_all_inputs(run_id, run, step, slot1_file, slot2_file, slot3_text, slot4_text, slot4_file):
    """Orchestrate extraction from all slots with sanity checks and AI verification."""
    with st.status("Processing inputs...", expanded=True) as proc_status:
        try:
            db.update_step(run_id, STEP_INDEX, status="running")
            all_terms = {}  # term_lower -> {term, targetMin, targetMax}
            merged_targets = {}
            all_call_info = []
            heading_terms_list = []
            ai_facts = []
            sanity_warnings = []
            ai_verification_issues = []
            source_parts = []
            slot1_image_bytes = None
            slot1_media_type = None

            # --- Slot 3: Pasted text (most reliable — process first) ---
            if slot3_text:
                st.write("Parsing pasted text (Slot 3)...")
                parsed_text, text_call_info = extract_from_text(slot3_text)
                all_call_info.append(text_call_info)
                _merge_terms(all_terms, parsed_text.get("terms", {}))
                _merge_targets_dict(merged_targets, parsed_text.get("targets", {}))
                source_parts.append("text_paste")

            # --- Slot 1: Keywords & Targets screenshot ---
            if slot1_file:
                st.write(f"Extracting from screenshot: {slot1_file.name} (Slot 1)...")
                slot1_image_bytes = slot1_file.read()
                ext = slot1_file.name.rsplit(".", 1)[-1].lower()
                slot1_media_type = _media_type(ext)

                parsed_ocr, ocr_call_infos = extract_with_ocr(slot1_image_bytes, slot1_media_type)
                all_call_info.extend(ocr_call_infos)
                _merge_terms(all_terms, parsed_ocr.get("terms", {}))
                _merge_targets_dict(merged_targets, parsed_ocr.get("targets", {}))
                source_parts.append("screenshot_ocr")

            # --- Merge and categorize terms ---
            flat_list = list(all_terms.values())
            categorized = categorize_terms(flat_list)
            merged_parsed = {"terms": categorized, "targets": merged_targets}

            # --- Layer 1: Sanity checks (free, deterministic) ---
            if HAS_OCR:
                st.write("Running sanity checks...")
                sanity_warnings_raw = sanity_check_targets(merged_targets, categorized)
                sanity_warnings = [w.to_dict() for w in sanity_warnings_raw]
                if sanity_warnings:
                    st.write(f"Found {len(sanity_warnings)} sanity warning(s)")

            # --- Layer 2: AI verification against source image ---
            if slot1_image_bytes:
                st.write("Running AI vision verification (~$0.06)...")
                try:
                    issues, verify_call_info = verify_extraction_with_image(
                        slot1_image_bytes, slot1_media_type, merged_parsed, "Keywords & Targets",
                    )
                    all_call_info.append(verify_call_info)
                    ai_verification_issues = issues
                    if issues:
                        st.write(f"AI flagged {len(issues)} issue(s)")
                except Exception as e:
                    logger.warning("AI verification failed: %s", e)
                    ai_verification_issues = [f"AI verification error: {e}"]

            # --- Slot 2: Headings tab screenshot ---
            if slot2_file:
                st.write(f"Extracting headings: {slot2_file.name} (Slot 2)...")
                slot2_bytes = slot2_file.read()
                ext2 = slot2_file.name.rsplit(".", 1)[-1].lower()
                parsed_h, h_call_infos = extract_with_ocr(slot2_bytes, _media_type(ext2))
                all_call_info.extend(h_call_infos)
                for priority in ("high_priority", "medium_priority", "low_priority"):
                    for t in parsed_h.get("terms", {}).get(priority, []):
                        heading_terms_list.append(t)
                # Heading terms always target 1 (appear at least once in a heading).
                # The number from Surfer is the current count, NOT the target.
                for t in heading_terms_list:
                    t["targetMin"] = 1
                    t["targetMax"] = 1
                source_parts.append("headings_ocr")

            # --- Slot 4: AI SEO Facts ---
            if slot4_text:
                st.write("Parsing AI SEO facts from text (Slot 4)...")
                lines = [ln.strip() for ln in slot4_text.strip().splitlines() if ln.strip()]
                ai_facts = [re.sub(r"^\d+[\.\)]\s*", "", ln) for ln in lines]
                source_parts.append("ai_facts_text")
            elif slot4_file:
                st.write(f"Extracting AI SEO facts: {slot4_file.name} (Slot 4)...")
                slot4_bytes = slot4_file.read()
                ext4 = slot4_file.name.rsplit(".", 1)[-1].lower()
                facts, facts_call_info = extract_ai_facts(slot4_bytes, _media_type(ext4))
                all_call_info.append(facts_call_info)
                ai_facts = facts
                source_parts.append("ai_facts_screenshot")

            # Preserve previously stored AI facts if nothing new
            if not ai_facts:
                prev_data = load_step_data(step)
                ai_facts = prev_data.get("ai_facts", [])

            # --- Cost summary ---
            total_cost = sum(ci.get("cost_usd", 0) for ci in all_call_info)
            term_count = len(flat_list) + len(heading_terms_list)
            proc_status.update(
                label=f"Done — {term_count} terms, {len(sanity_warnings)} warnings, ${total_cost:.3f}",
                state="complete",
            )

            # --- Save to step_data and move to review ---
            data = {
                "parsed": merged_parsed,
                "heading_terms": heading_terms_list,
                "ai_facts": ai_facts,
                "sanity_warnings": sanity_warnings,
                "ai_verification_issues": ai_verification_issues,
                "source": "+".join(source_parts) or "unknown",
                "call_info": {
                    "call_name": f"process_{'_'.join(source_parts)}",
                    "cost_usd": round(total_cost, 6),
                    "images_processed": sum(1 for s in source_parts if "ocr" in s or "screenshot" in s),
                },
            }
            save_step_data(run_id, STEP_INDEX, data)
            db.update_step(run_id, STEP_INDEX, status="review")

        except Exception as e:
            proc_status.update(label="Processing failed", state="error")
            db.update_step(run_id, STEP_INDEX, status="pending", error=str(e))
            error_display(f"Failed to process inputs: {e}")


# ======================================================================
# Save helper (unchanged from original)
# ======================================================================


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


# ======================================================================
# Review — categorized editors with accuracy warnings
# ======================================================================


def _render_review(run_id: str, run: dict, step: dict):
    """Render review interface with accuracy warnings and categorized term editors."""
    step_data = load_step_data(step)
    parsed = step_data.get("parsed", {})
    terms_dict = parsed.get("terms", {})
    targets = parsed.get("targets", {})
    heading_terms = step_data.get("heading_terms", [])
    sanity_warnings = step_data.get("sanity_warnings", [])
    ai_issues = step_data.get("ai_verification_issues", [])

    total_terms = _count_terms(terms_dict) + len(heading_terms)
    st.markdown(f"### Review — {total_terms} NLP terms extracted")

    call_info = step_data.get("call_info")
    if call_info:
        st.caption(f"API: {format_cost(call_info)}")

    # ---- Accuracy Warnings ----
    errors = [w for w in sanity_warnings if w["severity"] == "error"]
    warnings_list = [w for w in sanity_warnings if w["severity"] == "warning"]
    has_errors = bool(errors) or bool(ai_issues)

    if errors or ai_issues:
        st.markdown("#### Accuracy Errors")
        for w in errors:
            msg = w["message"]
            if w.get("suggested_value") is not None:
                msg += f" — auto-corrected to **{w['suggested_value']:,}**"
            st.error(msg)
        for issue in ai_issues:
            st.error(f"AI Vision: {issue}")

    if warnings_list:
        st.markdown("#### Warnings")
        for w in warnings_list:
            st.warning(w["message"])

    # ---- Build auto-corrected target defaults ----
    wc_min_default = targets.get("wordCount", {}).get("min", 1500)
    wc_max_default = targets.get("wordCount", {}).get("max", 2500)
    h_min_default = targets.get("headings", {}).get("min", 5)
    h_max_default = targets.get("headings", {}).get("max", 12)

    for w in sanity_warnings:
        if w.get("suggested_value") is not None and w.get("suggested_field"):
            field = w["suggested_field"]
            val = w["suggested_value"]
            if field == "wordCount.max":
                wc_max_default = val
            elif field == "wordCount.min":
                wc_min_default = val

    # ---- Targets ----
    st.markdown("#### Targets")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        wc_min = st.number_input("Word count min", value=wc_min_default, min_value=100, step=100, key=f"wc_min_{run_id}")
    with col2:
        wc_max = st.number_input("Word count max", value=wc_max_default, min_value=100, step=100, key=f"wc_max_{run_id}")
    with col3:
        h_min = st.number_input("Headings min", value=h_min_default, min_value=1, step=1, key=f"h_min_{run_id}")
    with col4:
        h_max = st.number_input("Headings max", value=h_max_default, min_value=1, step=1, key=f"h_max_{run_id}")

    if wc_min > wc_max:
        st.error("Word count min > max — fix before saving")
    if h_min > h_max:
        st.error("Headings min > max — fix before saving")

    # ---- Per-bucket term editors ----
    def _term_editor(label, terms_list, key_prefix):
        st.markdown(f"#### {label} ({len(terms_list)} terms)")
        df = pd.DataFrame([
            {
                "term": t["term"],
                "targetMin": t.get("targetMin", 1),
                "targetMax": t.get("targetMax", 3),
                "include": True,
            }
            for t in terms_list
        ]) if terms_list else pd.DataFrame(columns=["term", "targetMin", "targetMax", "include"])

        if df.empty:
            st.caption("No terms in this category")
            return df

        return st.data_editor(
            df,
            column_config={
                "term": st.column_config.TextColumn("Term", width="large"),
                "targetMin": st.column_config.NumberColumn("Min", min_value=0, max_value=500, width="small"),
                "targetMax": st.column_config.NumberColumn("Max", min_value=0, max_value=500, width="small"),
                "include": st.column_config.CheckboxColumn("Include", width="small"),
            },
            use_container_width=True,
            num_rows="dynamic",
            key=f"{key_prefix}_{run_id}",
        )

    high_edited = _term_editor("High Priority", terms_dict.get("high_priority", []), "ed_high")
    medium_edited = _term_editor("Medium Priority", terms_dict.get("medium_priority", []), "ed_med")
    low_edited = _term_editor("Low Priority", terms_dict.get("low_priority", []), "ed_low")
    heading_edited = _term_editor("Heading Terms", heading_terms, "ed_head")

    # ---- AI SEO Facts ----
    ai_facts = step_data.get("ai_facts", [])
    if ai_facts:
        with st.expander(f"AI SEO Facts ({len(ai_facts)})", expanded=False):
            for i, fact in enumerate(ai_facts, 1):
                st.markdown(f"{i}. {fact}")

    # ---- Cross-Link Sources (optional) ----
    st.divider()
    st.markdown("### Cross-Link Sources (Optional)")
    st.caption("Discover articles from your blog for internal cross-linking.")

    # Pre-fill from config if available
    default_url = ""
    try:
        config_dir = Path(__file__).resolve().parent.parent / "configs"
        for candidate in config_dir.glob("*.json"):
            if candidate.stem != "_template":
                c = json.loads(candidate.read_text(encoding="utf-8"))
                if c.get("name") == run.get("config_name", ""):
                    default_url = c.get("content", {}).get("internalLinkBase", "")
                    if default_url and not default_url.endswith("/blog"):
                        default_url += "/blog"
                    break
    except Exception:
        pass

    blog_url = st.text_input(
        "Blog index URL",
        value=default_url,
        placeholder="https://ofcpa.pro/blog",
        key=f"crosslink_url_{run_id}",
    )

    if blog_url and st.button("🔗 Discover Articles", key=f"discover_cl_{run_id}"):
        from lib.crosslinks import scrape_all_titles
        with st.status("Discovering articles via sitemap...") as cl_status:
            try:
                output_dir = pipeline.get_output_dir(run["slug"])
                # Extract base URL (strip /blog suffix for sitemap lookup)
                base_url = blog_url.rstrip("/")
                blog_prefix = ""
                if base_url.endswith("/blog"):
                    base_url = base_url[:-5]
                    blog_prefix = "/blog"
                articles = scrape_all_titles(base_url, output_dir, blog_path_prefix=blog_prefix)
                cl_status.update(label=f"Found {len(articles)} articles", state="complete")
                for a in articles[:15]:
                    st.caption(f"- {a['title']}")
                if len(articles) > 15:
                    st.caption(f"... and {len(articles) - 15} more")
            except Exception as e:
                cl_status.update(label="Discovery failed", state="error")
                st.error(str(e))

    # ---- Approve / Redo controls ----
    range_ok = wc_min <= wc_max and h_min <= h_max

    if has_errors:
        ack = st.checkbox(
            "I have reviewed the accuracy warnings and confirmed the values above are correct",
            key=f"ack_{run_id}",
        )
    else:
        ack = True

    col_approve, col_redo = st.columns(2)
    with col_approve:
        if st.button("Save & Continue", key=f"nlp_approve_{run_id}", type="primary", disabled=not (ack and range_ok)):
            combined_df = _combine_editors(high_edited, medium_edited, low_edited, heading_edited)
            _approve(run_id, run, combined_df, wc_min, wc_max, h_min, h_max, step_data)
            st.rerun()
    with col_redo:
        if st.button("Re-extract", key=f"nlp_redo_{run_id}"):
            db.update_step(run_id, STEP_INDEX, status="pending", output_json=None)
            st.rerun()

    json_viewer(parsed, "Raw extracted data")


# ======================================================================
# Approve + Approved display (unchanged from original)
# ======================================================================


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
    if prev_step_data and prev_step_data.get("ai_facts"):
        data["ai_facts"] = prev_step_data["ai_facts"]
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

    ai_facts = step_data.get("ai_facts", [])
    if ai_facts:
        with st.expander(f"AI SEO Facts ({len(ai_facts)})"):
            for i, fact in enumerate(ai_facts, 1):
                st.markdown(f"{i}. {fact}")

    with st.expander("View NLP targets"):
        json_viewer(nlp, "surfer-targets.json")
