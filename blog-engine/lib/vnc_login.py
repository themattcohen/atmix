"""VNC-based Surfer login session for headless servers.

Launches Xvfb + x11vnc + websockify so the user can log in to Surfer
via a noVNC browser tab, solving reCAPTCHA manually. Cookies persist
to data/browser-data/ for the pipeline's BrowserManager to reuse.
"""

import asyncio
import logging
import os
import subprocess
import time
from pathlib import Path

from playwright.async_api import async_playwright

logger = logging.getLogger("blog-engine.vnc-login")

ENGINE_ROOT = Path(__file__).resolve().parent.parent
USER_DATA_DIR = ENGINE_ROOT / "data" / "browser-data"

# Module-level state (survives Streamlit reruns within same worker process)
_xvfb_proc: subprocess.Popen | None = None
_x11vnc_proc: subprocess.Popen | None = None
_websockify_proc: subprocess.Popen | None = None
_playwright = None
_context = None
_page = None


def _kill_stale_processes():
    """Kill orphaned VNC processes from prior Streamlit restarts."""
    for pattern in ["Xvfb :99", "x11vnc -display :99", "websockify.*6080"]:
        try:
            subprocess.run(
                ["pkill", "-f", pattern],
                capture_output=True, timeout=5,
            )
        except Exception:
            pass
    time.sleep(0.5)


def _terminate(proc: subprocess.Popen | None):
    """SIGTERM a process, wait 3s, then SIGKILL if still alive."""
    if proc is None or proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=2)
    except Exception:
        pass


async def start_login_session() -> dict:
    """Start Xvfb + headed Chromium + x11vnc + websockify for manual login."""
    global _xvfb_proc, _x11vnc_proc, _websockify_proc
    global _playwright, _context, _page

    _kill_stale_processes()

    # Remove stale SingletonLock
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock = USER_DATA_DIR / "SingletonLock"
    if lock.exists():
        logger.warning("[vnc] Removing stale SingletonLock")
        try:
            lock.unlink()
        except OSError:
            pass

    # 1. Start Xvfb
    _xvfb_proc = subprocess.Popen(
        ["Xvfb", ":99", "-screen", "0", "1280x900x24", "-nolisten", "tcp"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    if _xvfb_proc.poll() is not None:
        return {"ok": False, "error": "Xvfb failed to start"}

    os.environ["DISPLAY"] = ":99"

    # 2. Launch Playwright Chromium headed
    try:
        _playwright = await async_playwright().start()
        _context = await asyncio.wait_for(
            _playwright.chromium.launch_persistent_context(
                user_data_dir=str(USER_DATA_DIR),
                headless=False,
                viewport={"width": 1280, "height": 900},
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            ),
            timeout=30.0,
        )
        _page = await _context.new_page()
        await _page.goto("https://app.surferseo.com/login", wait_until="domcontentloaded", timeout=20000)
    except Exception as exc:
        logger.error("[vnc] Playwright launch failed: %s", exc)
        await stop_login_session()
        return {"ok": False, "error": str(exc)}

    # 3. Start x11vnc
    _x11vnc_proc = subprocess.Popen(
        ["x11vnc", "-display", ":99", "-rfbport", "5900",
         "-nopw", "-forever", "-shared", "-localhost"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)

    # 4. Start websockify (noVNC bridge)
    _websockify_proc = subprocess.Popen(
        ["websockify", "--web", "/usr/share/novnc", "6080", "localhost:5900"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)

    logger.info("[vnc] Login session started — Xvfb:%s x11vnc:%s websockify:%s",
                _xvfb_proc.pid, _x11vnc_proc.pid, _websockify_proc.pid)
    return {"ok": True}


async def stop_login_session():
    """Tear down VNC login session. Playwright first so cookies flush."""
    global _xvfb_proc, _x11vnc_proc, _websockify_proc
    global _playwright, _context, _page

    # 1. Close Playwright (flushes cookies to browser-data)
    if _page:
        try:
            await _page.close()
        except Exception:
            pass
    if _context:
        try:
            await _context.close()
        except Exception:
            pass
    if _playwright:
        try:
            await _playwright.stop()
        except Exception:
            pass

    # 2. Kill VNC stack
    _terminate(_websockify_proc)
    _terminate(_x11vnc_proc)
    _terminate(_xvfb_proc)

    # 3. Restore headless environment
    os.environ.pop("DISPLAY", None)

    # 4. Clear module state
    _page = None
    _context = None
    _playwright = None
    _websockify_proc = None
    _x11vnc_proc = None
    _xvfb_proc = None

    logger.info("[vnc] Login session stopped")


async def verify_login() -> bool:
    """Check if Surfer login succeeded by navigating to drafts."""
    if _page is None:
        return False
    try:
        await _page.goto("https://app.surferseo.com/drafts",
                         wait_until="domcontentloaded", timeout=15000)
        return "login" not in _page.url.lower()
    except Exception:
        return False


def is_session_active() -> bool:
    """True if VNC session processes are still running."""
    return _xvfb_proc is not None and _xvfb_proc.poll() is None
