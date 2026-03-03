"""Playwright browser management with persistent cookie storage."""

import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

ENGINE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_USER_DATA_DIR = ENGINE_ROOT / "data" / "browser-data"


class BrowserManager:
    """Manages persistent Playwright Chromium context with saved cookies."""

    def __init__(self, user_data_dir: str | Path | None = None, headless: bool = True):
        self._user_data_dir = str(user_data_dir or DEFAULT_USER_DATA_DIR)
        self._headless = headless
        self._playwright = None
        self._context: BrowserContext | None = None

    async def launch(self) -> None:
        """Launch browser with persistent context. Cookies survive restarts."""
        if sys.platform == "linux" and not os.environ.get("DISPLAY"):
            self._headless = True
        Path(self._user_data_dir).mkdir(parents=True, exist_ok=True)
        self._playwright = await async_playwright().start()
        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=self._user_data_dir,
            headless=self._headless,
            viewport={"width": 1440, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )

    async def new_page(self) -> Page:
        """Create a new page in the persistent context."""
        if not self._context:
            raise RuntimeError("Browser not launched. Call launch() first.")
        return await self._context.new_page()

    async def close(self) -> None:
        """Close browser and playwright."""
        if self._context:
            await self._context.close()
            self._context = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def screenshot(self, page: Page, path: str) -> str:
        """Take full-page screenshot, save to path, return path."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=path, full_page=True)
        return path

    async def check_login(self, service: str) -> bool:
        """Check if logged into 'semrush' or 'surfer'."""
        if not self._context:
            return False
        page = await self.new_page()
        try:
            if service == "semrush":
                await page.goto("https://www.semrush.com/analytics/overview/", wait_until="domcontentloaded", timeout=15000)
                # If redirected to login page, not logged in
                return "login" not in page.url.lower() and "signin" not in page.url.lower()
            elif service == "surfer":
                await page.goto("https://app.surferseo.com/", wait_until="domcontentloaded", timeout=15000)
                return "login" not in page.url.lower() and "signin" not in page.url.lower()
            return False
        except Exception:
            return False
        finally:
            await page.close()

    @property
    def is_launched(self) -> bool:
        return self._context is not None
