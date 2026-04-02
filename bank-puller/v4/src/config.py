"""Settings — loaded from environment and/or bank-puller/.env."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings


# ---------------------------------------------------------------------------
# Load .env from the bank-puller root (two levels above this file:
#   src/config.py  ->  v4/  ->  bank-puller/  (.env lives here)
# This runs at import time so all subsequent os.environ reads see the values.
# ---------------------------------------------------------------------------
_DOTENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_DOTENV_PATH, override=False)


MODEL_HAIKU  = "anthropic/claude-haiku-4-5-20251001"
MODEL_SONNET = "anthropic/claude-sonnet-4-6-20250527"


class Settings(BaseSettings):
    """Runtime configuration resolved from environment variables.

    Required:
        ANTHROPIC_API_KEY

    Optional (all have sensible defaults):
        ACCOUNTS_PATH, OUTPUT_DIR, PROFILES_DIR, DOWNLOAD_DIR,
        CHECKPOINT_DIR, SLACK_WEBHOOK_URL, DIALPAD_WEBHOOK_URL,
        DIALPAD_EMAIL, DIALPAD_PASSWORD,
        BROWSER_USE_API_KEY,
        HEADLESS, CDP_PORT_START, PROXY_URL,
        MAX_RETRIES_PER_PHASE, SMS_TIMEOUT_SEC
    """

    # Required
    anthropic_api_key: str

    # Dialpad SMS interception credentials
    dialpad_email:    str | None = None
    dialpad_password: str | None = None

    # BrowserUse cloud API key (reserved for cloud CDP usage)
    browser_use_api_key: str | None = None

    # File paths
    accounts_path:  Path = Path("clients.xlsx")
    output_dir:     Path = Path("output")
    profiles_dir:   Path = Path("profiles")
    download_dir:   Path = Path("downloads")
    checkpoint_dir: Path = Path("checkpoints")

    # Browser behaviour
    headless:       bool = False
    cdp_port_start: int  = 9222

    # Optional webhook integrations
    slack_webhook_url:   str | None = None
    dialpad_webhook_url: str | None = None   # local Dialpad webhook sidecar URL

    # Residential proxy (needed by some banks)
    proxy_url: str | None = None

    # Retry / timeout tuning
    max_retries_per_phase: int = 2
    sms_timeout_sec:       int = 90

    # ------------------------------------------------------------------
    # Convenience property aliases (used in design-doc naming convention)
    # ------------------------------------------------------------------

    @property
    def DEFAULT_MODEL(self) -> str:      # noqa: N802
        return MODEL_HAIKU

    @property
    def FALLBACK_MODEL(self) -> str:     # noqa: N802
        return MODEL_SONNET

    @property
    def OUTPUT_BASE_DIR(self) -> Path:   # noqa: N802
        return self.output_dir

    @property
    def DOWNLOAD_DIR(self) -> Path:      # noqa: N802
        return self.download_dir

    @property
    def PROFILES_DIR(self) -> Path:      # noqa: N802
        return self.profiles_dir

    @property
    def CHECKPOINT_DIR(self) -> Path:    # noqa: N802
        return self.checkpoint_dir

    @property
    def SLACK_WEBHOOK_URL(self) -> str | None:   # noqa: N802
        return self.slack_webhook_url

    class Config:
        # pydantic-settings will also scan os.environ after load_dotenv() above
        env_file = str(_DOTENV_PATH)
        env_file_encoding = "utf-8"
        # Allow extra fields so the .env file can contain keys we haven't
        # declared without causing a validation error
        extra = "ignore"
