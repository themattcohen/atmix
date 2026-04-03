"""Browser process lifecycle management.

Launches a stealth Chromium process on a CDP port and provides
a clean async context for BrowserUse to attach to.
"""

from __future__ import annotations

import asyncio
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error


# ---------------------------------------------------------------------------
# Port allocation
# ---------------------------------------------------------------------------

def find_free_port(start: int = 9300, end: int = 9399) -> int:
    """Return the first available TCP port in [start, end).

    Tries to bind a socket on each port; if binding succeeds the port is
    available (the socket is immediately closed before returning).

    Raises RuntimeError if no port is free in the range.
    """
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(
        f"No free TCP port found in range [{start}, {end}). "
        "Close some browsers or widen the port range."
    )


# ---------------------------------------------------------------------------
# Chrome argument builder
# ---------------------------------------------------------------------------

def build_chrome_args(
    cdp_port: int,
    profile_dir: Path,
    headless: bool,
    proxy: Optional[str] = None,
    download_dir: Optional[Path] = None,
    stealth: bool = True,
) -> list[str]:
    """Return the full argv list for launching Chrome with CDP enabled.

    Key flags:
      --remote-debugging-port      exposes the CDP endpoint BrowserUse connects to
      --user-data-dir              persistent profile (trusted-device cookies survive)
      --disable-blink-features     hides automation signals from bot-detection
      --no-first-run               suppresses the first-run wizard overlay
      --disable-infobars           removes the "Chrome is being controlled" bar
    """
    profile_dir.mkdir(parents=True, exist_ok=True)
    # Chrome's singleton check uses the absolute path — resolve to avoid
    # collisions with the user's default Chrome profile.
    abs_profile = str(profile_dir.resolve())

    args: list[str] = [
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={abs_profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-infobars",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-extensions-except=",
        "--disable-plugins-discovery",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-service-autorun",
        "--password-store=basic",
        "--use-mock-keychain",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        # Avoid crash reporter noise
        "--disable-crash-reporter",
        "--noerrdialogs",
    ]

    # Stealth flag — hides automation signals from bank bot detection.
    # Skip for non-bank sites (e.g., Dialpad) where it breaks WebSockets.
    if stealth:
        args.append("--disable-blink-features=AutomationControlled")

    if headless:
        args.append("--headless=new")

    if proxy:
        args.append(f"--proxy-server={proxy}")

    if download_dir:
        download_dir.mkdir(parents=True, exist_ok=True)

    return args


# ---------------------------------------------------------------------------
# Chrome executable discovery
# ---------------------------------------------------------------------------

def _find_chrome_executable() -> Optional[str]:
    """Search for Chrome or Chromium in standard install locations.

    Returns the absolute path string if found, None otherwise.
    """
    # Try PATH first (covers most Linux/macOS setups and custom Windows installs)
    for name in ("google-chrome", "google-chrome-stable", "chromium-browser",
                 "chromium", "chrome"):
        found = shutil.which(name)
        if found:
            return found

    # Windows default install paths
    if sys.platform == "win32":
        import os
        candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(
                r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
            ),
            r"C:\Program Files\Chromium\Application\chrome.exe",
        ]
        for c in candidates:
            if Path(c).exists():
                return c

    # macOS
    if sys.platform == "darwin":
        mac_candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
        for c in mac_candidates:
            if Path(c).exists():
                return c

    # Linux fallback paths
    linux_candidates = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
    ]
    for c in linux_candidates:
        if Path(c).exists():
            return c

    return None


# ---------------------------------------------------------------------------
# CDP readiness probe
# ---------------------------------------------------------------------------

def _cdp_is_ready(port: int) -> bool:
    """Return True if the CDP /json/version endpoint responds with HTTP 200."""
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/json/version", timeout=1
        ) as resp:
            return resp.status == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# BrowserProcess
# ---------------------------------------------------------------------------

class BrowserProcess:
    """Manages the lifecycle of a stealth Chromium process.

    Typical usage (async context):

        browser = BrowserProcess(cdp_port=9222, profile_dir=Path("profiles/chase__user"))
        await browser.start()
        # ... attach BrowserUse ...
        await browser.stop()

    Or use as an async context manager:

        async with BrowserProcess(9222, profile_dir) as browser:
            bu = Browser(cdp_url=browser.cdp_url, ...)
    """

    def __init__(
        self,
        cdp_port: int,
        profile_dir: Path,
        headless: bool = False,
        proxy: Optional[str] = None,
        download_dir: Optional[Path] = None,
        startup_timeout: float = 15.0,
        stealth: bool = True,
    ) -> None:
        self.cdp_port = cdp_port
        self.profile_dir = profile_dir
        self.headless = headless
        self.proxy = proxy
        self.download_dir = download_dir
        self.startup_timeout = startup_timeout
        self.stealth = stealth
        self._proc: Optional[subprocess.Popen] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Launch Chrome/Chromium on self.cdp_port with self.profile_dir.

        Strategy:
          1. Clean stale Chrome lock files from the profile directory
             (prevents Chrome from delegating to a dead instance).
          2. Try to import nodriver and use its bundled Chromium path.
          3. Fall back to finding Chrome/Chromium in standard install locations.

        Waits until the CDP endpoint is accepting connections before
        returning.  Raises RuntimeError if startup times out.
        """
        # Remove stale lock files that prevent fresh Chrome launch
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        for lock_name in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
            lock = self.profile_dir / lock_name
            if lock.exists() or lock.is_symlink():
                try:
                    lock.unlink()
                except OSError:
                    pass

        executable = await self._resolve_executable()

        chrome_args = build_chrome_args(
            cdp_port=self.cdp_port,
            profile_dir=self.profile_dir,
            headless=self.headless,
            proxy=self.proxy,
            download_dir=self.download_dir,
            stealth=self.stealth,
        )

        cmd = [executable] + chrome_args

        self._proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        await self._wait_for_cdp()

    async def stop(self) -> None:
        """Terminate the browser process and wait for it to exit."""
        if self._proc is None:
            return
        try:
            self._proc.terminate()
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self._proc.wait(timeout=5)
                )
            except subprocess.TimeoutExpired:
                self._proc.kill()
                self._proc.wait()
        except Exception:
            pass
        finally:
            self._proc = None

    async def __aenter__(self) -> "BrowserProcess":
        await self.start()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.stop()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def cdp_url(self) -> str:
        return f"http://localhost:{self.cdp_port}"

    @property
    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _resolve_executable(self) -> str:
        """Return the Chrome/Chromium executable path to use.

        Tries nodriver's bundled Chromium first (better stealth), then
        falls back to system-installed Chrome/Chromium.
        """
        # Attempt 1: nodriver bundled binary
        try:
            import nodriver  # type: ignore[import-not-found]
            # nodriver exposes the path to its bundled Chromium via its config
            nd_config = nodriver.Config()
            if nd_config.browser_executable_path:
                candidate = Path(nd_config.browser_executable_path)
                if candidate.exists():
                    return str(candidate)
        except Exception:
            pass

        # Attempt 2: system Chrome/Chromium
        exe = _find_chrome_executable()
        if exe:
            return exe

        raise RuntimeError(
            "Could not find Chrome or Chromium. "
            "Install Google Chrome or set the path explicitly. "
            "Alternatively, install the 'nodriver' package which bundles Chromium."
        )

    async def _wait_for_cdp(self) -> None:
        """Poll http://localhost:{port}/json/version until ready or timeout."""
        deadline = time.monotonic() + self.startup_timeout
        poll_interval = 0.25

        while time.monotonic() < deadline:
            # Check that the process hasn't crashed
            if self._proc and self._proc.poll() is not None:
                raise RuntimeError(
                    f"Browser process exited unexpectedly (code {self._proc.returncode}) "
                    "before CDP became ready."
                )

            if _cdp_is_ready(self.cdp_port):
                return

            await asyncio.sleep(poll_interval)

        raise RuntimeError(
            f"Browser CDP endpoint not ready after {self.startup_timeout}s "
            f"on port {self.cdp_port}. Check that the browser launched correctly."
        )
