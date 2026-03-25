"""Phase 0: Patchright proof-of-concept -- does it fix blank pages on bot-protected banks?

Run: pip install patchright && patchright install chrome && python test_patchright.py
"""
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

import asyncio
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path
from patchright.async_api import async_playwright

BANKS = {
    "chase": "https://secure.chase.com",
    "eastwest": "https://www.eastwestbank.com/signin",
    "citibank": "https://online.citi.com",
    "mercury": "https://app.mercury.com/login",
    "bankofamerica": "https://www.bankofamerica.com/",
    "amex": "https://www.americanexpress.com/",
}

SCREENSHOT_DIR = Path("debug-screenshots")


async def main():
    SCREENSHOT_DIR.mkdir(exist_ok=True)
    pw = await async_playwright().start()

    context = await pw.chromium.launch_persistent_context(
        user_data_dir=str(Path("browser-profiles/patchright-test")),
        headless=False,
        channel="chrome",
        no_viewport=True,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
        ],
    )

    page = context.pages[0] if context.pages else await context.new_page()

    for name, url in BANKS.items():
        print(f"\n{'='*60}")
        print(f"Testing: {name} -> {url}")
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for page to render
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass
            await page.wait_for_timeout(5000)  # extra settle time

            path = SCREENSHOT_DIR / f"patchright_test_{name}.png"
            screenshot = await page.screenshot(type="png", full_page=False)
            path.write_bytes(screenshot)

            size_kb = len(screenshot) / 1024
            has_content = size_kb > 15
            status = "CONTENT" if has_content else "BLANK"
            print(f"  Screenshot: {path} ({size_kb:.1f} KB) → {status}")
        except Exception as e:
            print(f"  ERROR: {e}")

    await context.close()
    await pw.stop()

    print(f"\n{'='*60}")
    print("Done. Check screenshots in debug-screenshots/")


if __name__ == "__main__":
    asyncio.run(main())
