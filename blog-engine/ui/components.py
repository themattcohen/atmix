"""Reusable Streamlit UI components for the blog-engine pipeline."""

import asyncio
import json
import threading
import streamlit as st
from pathlib import Path


# ---------------------------------------------------------------------------
# Async helper — persistent event loop
# ---------------------------------------------------------------------------
# Playwright objects (browser context, pages) are bound to the event loop
# that created them.  Using asyncio.run() per call destroys the loop after
# each coroutine, making subsequent calls on the same objects hang forever.
# Instead we keep ONE loop alive in a daemon thread and schedule all
# coroutines onto it.

_async_loop: asyncio.AbstractEventLoop | None = None
_async_thread: threading.Thread | None = None
_loop_lock = threading.Lock()


def _get_persistent_loop() -> asyncio.AbstractEventLoop:
    """Return (and lazily create) a long-lived background event loop."""
    global _async_loop, _async_thread
    with _loop_lock:
        if _async_loop is None or _async_loop.is_closed():
            _async_loop = asyncio.new_event_loop()
            _async_thread = threading.Thread(
                target=_async_loop.run_forever, daemon=True, name="async-loop",
            )
            _async_thread.start()
    return _async_loop


def run_async(coro):
    """Run an async coroutine from synchronous Streamlit code.

    All coroutines share a single persistent event loop so that Playwright
    browser contexts and pages remain valid across successive calls.
    """
    loop = _get_persistent_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result()


# ---------------------------------------------------------------------------
# Progress bar
# ---------------------------------------------------------------------------

def pipeline_progress(steps: list[dict], current_step: int):
    """Render a horizontal pipeline progress indicator.

    Each step shows its icon plus a status marker:
    - Completed (index < current_step): green checkmark
    - Current  (index == current_step): blue spinner
    - Pending  (index > current_step): gray circle
    """
    segments: list[str] = []
    for s in steps:
        idx = s["index"]
        icon = s.get("icon", "")
        label = s.get("label", f"Step {idx}")
        if idx < current_step:
            marker = '<span style="color:#28a745;">&#10004;</span>'
            bg = "#d4edda"
            text_color = "#155724"
        elif idx == current_step:
            marker = '<span style="color:#007bff;">&#9679;</span>'
            bg = "#cce5ff"
            text_color = "#004085"
        else:
            marker = '<span style="color:#6c757d;">&#9675;</span>'
            bg = "#e9ecef"
            text_color = "#495057"

        segments.append(
            f'<div style="display:inline-block;text-align:center;padding:6px 10px;'
            f'margin:0 4px;border-radius:8px;background:{bg};min-width:90px;">'
            f'<div style="font-size:1.3em;">{icon}{marker}</div>'
            f'<div style="font-size:0.75em;color:{text_color};white-space:nowrap;">{label}</div>'
            f"</div>"
        )

    # Connector arrows between segments
    html_parts: list[str] = []
    for i, seg in enumerate(segments):
        html_parts.append(seg)
        if i < len(segments) - 1:
            html_parts.append(
                '<span style="display:inline-block;vertical-align:middle;'
                'font-size:1.1em;color:#adb5bd;margin:0 2px;">&#8594;</span>'
            )

    st.markdown(
        f'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;'
        f'padding:10px 0;">{"".join(html_parts)}</div>',
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Step header
# ---------------------------------------------------------------------------

def step_header(step_info: dict, status: str):
    """Render a step header with icon, label, and a colored status badge."""
    icon = step_info.get("icon", "")
    label = step_info.get("label", "")
    status_colors = {
        "pending": "gray",
        "running": "blue",
        "review": "orange",
        "approved": "green",
        "skipped": "gray",
        "failed": "red",
    }
    color = status_colors.get(status, "gray")
    st.markdown(f"## {icon} {label}")
    st.markdown(f"**Status:** :{color}[{status.upper()}]")


# ---------------------------------------------------------------------------
# Approve / Edit / Redo controls
# ---------------------------------------------------------------------------

def approve_controls(key_prefix: str) -> str | None:
    """Render approve / edit / redo buttons and return the chosen action.

    Returns one of ``"approve"``, ``"edit"``, ``"redo"``, or ``None`` if no
    button was pressed this render cycle.
    """
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("Approve", key=f"{key_prefix}_approve", type="primary"):
            return "approve"
    with col2:
        if st.button("Edit", key=f"{key_prefix}_edit"):
            return "edit"
    with col3:
        if st.button("Redo", key=f"{key_prefix}_redo"):
            return "redo"
    return None


# ---------------------------------------------------------------------------
# Screenshot viewer
# ---------------------------------------------------------------------------

def screenshot_viewer(screenshot_path: str | None):
    """Display a screenshot image if it exists on disk."""
    if screenshot_path and Path(screenshot_path).exists():
        st.image(str(screenshot_path), use_container_width=True)
    elif screenshot_path:
        st.warning(f"Screenshot not found: {screenshot_path}")


# ---------------------------------------------------------------------------
# JSON viewer
# ---------------------------------------------------------------------------

def json_viewer(data: dict | list, label: str = "Data"):
    """Display JSON data inside an expandable section."""
    with st.expander(f"Raw {label}", expanded=False):
        st.json(data)


# ---------------------------------------------------------------------------
# Error display
# ---------------------------------------------------------------------------

def error_display(error: str | None):
    """Display an error banner if *error* is truthy."""
    if error:
        st.error(f"Error: {error}")


# ---------------------------------------------------------------------------
# Status badge
# ---------------------------------------------------------------------------

def status_badge(status: str) -> str:
    """Return a single-character status badge for inline use."""
    badges = {
        "pending": "---",
        "running": "...",
        "review": "?",
        "approved": "OK",
        "skipped": ">>",
        "failed": "X",
    }
    return badges.get(status, "---")


# ---------------------------------------------------------------------------
# Step data helpers
# ---------------------------------------------------------------------------

def load_step_data(step: dict | None) -> dict:
    """Safely parse ``output_json`` from a step row into a dict."""
    if step and step.get("output_json"):
        try:
            return json.loads(step["output_json"])
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def save_step_data(run_id: str, step_index: int, data: dict):
    """Persist *data* as the step's ``output_json``."""
    from lib import db  # deferred to avoid circular import at module level
    db.update_step(run_id, step_index, output_json=json.dumps(data))


def load_step_screenshots(step: dict | None) -> list[str]:
    """Return the list of screenshot paths stored on a step row."""
    if step and step.get("screenshots"):
        try:
            val = step["screenshots"]
            if isinstance(val, str):
                return json.loads(val)
            if isinstance(val, list):
                return val
        except (json.JSONDecodeError, TypeError):
            pass
    return []
