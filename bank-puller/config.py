"""Bank Statement Automator — Configuration."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
CLIENTS_XLSX = BASE_DIR / "clients.xlsx"
BROWSER_PROFILES_DIR = BASE_DIR / "browser-profiles"
DOWNLOADS_DIR = BASE_DIR / "downloads"
OUTPUT_DIR = BASE_DIR / "output"
DEBUG_SCREENSHOTS_DIR = BASE_DIR / "debug-screenshots"
LOGS_DIR = BASE_DIR / "logs"
PLAYBOOKS_DIR = BASE_DIR / "playbooks"

# Override target month (set via --month flag). None = auto (previous month).
TARGET_MONTH_OVERRIDE: str | None = None

# ---------------------------------------------------------------------------
# Playbook settings
# ---------------------------------------------------------------------------
PLAYBOOK_MAX_AGE_DAYS = 30

# SECURITY NOTE: Credentials are stored in plaintext in the Excel workbook.
# For MVP this is acceptable since the workbook is local-only and access-controlled.
# Future: consider OS keychain integration (keyring library) or encrypted vault.

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = "claude-sonnet-4-6"  # Cost-effective for vision tasks
AI_MODEL_FAST = "claude-haiku-4-5-20251001"  # Cheaper for simple classification/OCR

# ---------------------------------------------------------------------------
# AI Skill Settings
# ---------------------------------------------------------------------------
AI_MAX_RETRIES = 2
AI_CONFIDENCE_THRESHOLD = 0.7

# ---------------------------------------------------------------------------
# Browser
# ---------------------------------------------------------------------------
MAX_CONCURRENT_BANK_WINDOWS = 2
SCREENSHOT_RESOLUTION = {"width": 1920, "height": 1080}
AI_SCREENSHOT_RESOLUTION = {"width": 960, "height": 540}  # Downscaled for AI calls (~75% token savings)
MAX_SCREENSHOTS_IN_MEMORY = 5
BROWSER_CHANNEL = os.getenv("BROWSER_CHANNEL", "chrome")  # "chrome" = system Chrome, "" = bundled Chromium
BROWSER_LOCALE = "en-US"
BROWSER_TIMEZONE = "America/Denver"

# ---------------------------------------------------------------------------
# Dialpad
# ---------------------------------------------------------------------------
DIALPAD_DEPT_NAME = "Compound Accounting"

# ---------------------------------------------------------------------------
# Timeouts (milliseconds)
# ---------------------------------------------------------------------------
TIMEOUTS = {
    "page_navigation": 30_000,
    "element_search": 10_000,
    "2fa_code_wait": 120_000,
    "push_2fa_wait": 180_000,
    "pdf_download": 30_000,
    "session_total": 480_000,  # 480s = 8 minutes per bank+username group (allows for 2FA + multi-account)
    "run_total": 3_600_000,
}

# ---------------------------------------------------------------------------
# Human-like behavior delays
# ---------------------------------------------------------------------------
HUMAN_TYPE_DELAY_MIN = 50  # ms between keystrokes
HUMAN_TYPE_DELAY_MAX = 150
HUMAN_CLICK_PAUSE_MIN = 0.5  # seconds
HUMAN_CLICK_PAUSE_MAX = 1.5
HUMAN_ACTION_DELAY_MIN = 1.0  # seconds
HUMAN_ACTION_DELAY_MAX = 3.0

# ---------------------------------------------------------------------------
# Resource limits
# ---------------------------------------------------------------------------
MEMORY_WARNING_THRESHOLD = 85  # percent

# ---------------------------------------------------------------------------
# Screenshot policy
# ---------------------------------------------------------------------------
DEBUG_SCREENSHOTS = False  # Set True via --debug flag

# ---------------------------------------------------------------------------
# Retry backoff (days)
# ---------------------------------------------------------------------------
RETRY_BACKOFF = {1: 0, 2: 1, 3: 3}  # retry_count: wait_days
MAX_RETRY_COUNT = 3  # After this, mark as "abandoned"

# ---------------------------------------------------------------------------
# Stale credential warning threshold (days)
# ---------------------------------------------------------------------------
STALE_CREDENTIAL_DAYS = 90

# ---------------------------------------------------------------------------
# File naming
# ---------------------------------------------------------------------------
OUTPUT_FILENAME_TEMPLATE = "{client}__{bank} #{last4} {year_month}.pdf"
