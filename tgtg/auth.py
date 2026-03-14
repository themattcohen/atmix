"""TGTG API authentication with DataDome bypass.

The official `tgtg` PyPI package is broken due to DataDome bot detection.
This module implements the workaround from Der-Henning/tgtg-scanner:
fetch a DataDome cookie from their SDK endpoint before each API call.
"""

import json
import os
import random
import re
import sys
import time
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv, set_key

ENV_PATH = Path(__file__).parent / ".env"

BASE_URL = "https://apptoogoodtogo.com/api/"
AUTH_BY_EMAIL_ENDPOINT = "auth/v5/authByEmail"
AUTH_POLLING_ENDPOINT = "auth/v5/authByRequestPollingId"
REFRESH_ENDPOINT = "token/v1/refresh"
API_ITEM_ENDPOINT = "item/v8/"
DEFAULT_APK_VERSION = "26.3.0"

APK_RE_SCRIPT = re.compile(r"AF_initDataCallback\({key:\s*'ds:5'.*?data:([\s\S]*?), sideChannel:.+<\/script")

USER_AGENTS = [
    "TGTG/{} Dalvik/2.1.0 (Linux; U; Android 9; Nexus 5 Build/M4B30Z)",
    "TGTG/{} Dalvik/2.1.0 (Linux; U; Android 10; SM-G935F Build/NRD90M)",
    "TGTG/{} Dalvik/2.1.0 (Linux; Android 12; SM-G920V Build/MMB29K)",
]

MAX_POLLING_TRIES = 60   # 60 * 5s = 5 minutes
POLLING_WAIT_TIME = 5


def _generate_datadome_cid() -> str:
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_"
    return "".join(random.choice(chars) for _ in range(120))


def _fetch_datadome_cookie(request_url: str, user_agent: str, apk_version: str) -> str | None:
    """Fetch a fresh DataDome cookie from their SDK endpoint."""
    params = {
        "camera": '{"auth":"true", "info":"{\\"front\\":\\"2000x1500\\",\\"back\\":\\"5472x3648\\"}"}',
        "cid": _generate_datadome_cid(),
        "ddk": "1D42C2CA6131C526E09F294FE96F94",
        "ddv": "3.0.4",
        "ddvc": apk_version,
        "events": '[{"id":1,"message":"response validation","source":"sdk","date":' + str(int(time.time() * 1000)) + "}]",
        "inte": "android-java-okhttp",
        "mdl": "Pixel 7 Pro",
        "os": "Android",
        "osn": "UPSIDE_DOWN_CAKE",
        "osr": "14",
        "osv": "34",
        "request": request_url,
        "screen_d": "3.5",
        "screen_x": "1440",
        "screen_y": "3120",
        "ua": user_agent,
    }
    try:
        r = requests.post(
            "https://api-sdk.datadome.co/sdk/",
            data=params,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "*/*",
                "User-Agent": user_agent,
                "Accept-Encoding": "gzip, deflate, br",
            },
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("status") == 200 and data.get("cookie"):
            m = re.search(r"datadome=([^;]+)", data["cookie"])
            if m:
                return m.group(1)
    except Exception as e:
        print(f"  Warning: DataDome cookie fetch failed: {e}")
    return None


class TgtgClient:
    """Minimal TGTG API client with DataDome bypass."""

    def __init__(self, email: str, access_token: str = "", refresh_token: str = "",
                 datadome_cookie: str = ""):
        self.email = email
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.datadome_cookie = datadome_cookie
        self._last_token_time = time.time() if access_token else None
        self.apk_version = self._get_apk_version()
        self.user_agent = random.choice(USER_AGENTS).format(self.apk_version)
        self.correlation_id = str(uuid.uuid4())
        self._create_session()

    @staticmethod
    def _get_apk_version() -> str:
        """Fetch latest TGTG APK version from Google Play Store."""
        try:
            r = requests.get(
                "https://play.google.com/store/apps/details?id=com.app.tgtg&hl=en&gl=US",
                timeout=10,
            )
            match = APK_RE_SCRIPT.search(r.text)
            if match:
                data = json.loads(match.group(1))
                version = data[1][2][140][0][0][0]
                return version
        except Exception:
            pass
        return DEFAULT_APK_VERSION

    def _create_session(self) -> None:
        """Create a fresh requests session with proper headers and datadome cookie."""
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "Accept-Language": "en-GB",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": self.user_agent,
            "x-correlation-id": self.correlation_id,
        })
        # Set datadome in cookie jar (not as header) so requests manages it
        if self.datadome_cookie:
            self.session.cookies.set("datadome", self.datadome_cookie,
                                     domain=".apptoogoodtogo.com", path="/")

    def _ensure_datadome(self, url: str) -> None:
        """Fetch a DataDome cookie if we don't have one in the jar."""
        if "datadome" not in self.session.cookies:
            dd = _fetch_datadome_cookie(url, self.user_agent, self.apk_version)
            if dd:
                self.datadome_cookie = dd
                self.session.cookies.set("datadome", dd,
                                         domain=".apptoogoodtogo.com", path="/")

    def _post(self, endpoint: str, json_data: dict) -> requests.Response:
        url = BASE_URL + endpoint
        self._ensure_datadome(url)

        headers = {}
        if self.access_token:
            headers["authorization"] = f"Bearer {self.access_token}"

        time.sleep(1)  # rate limit like the real app
        response = self.session.post(url, json=json_data, headers=headers, timeout=30)

        # Update datadome cookie from response
        dd_from_jar = self.session.cookies.get("datadome")
        if dd_from_jar:
            self.datadome_cookie = dd_from_jar

        return response

    def login(self) -> None:
        """Authenticate — refresh existing tokens or do email magic-link flow."""
        if self.access_token and self.refresh_token:
            # Skip refresh if token was recently set (within 4 hours)
            if self._last_token_time and (time.time() - self._last_token_time) < 14400:
                return
            self._refresh()
        else:
            self._email_login()

    def _refresh(self) -> None:
        """Refresh existing tokens."""
        response = self._post(REFRESH_ENDPOINT, {"refresh_token": self.refresh_token})
        if response.status_code == 200:
            data = response.json()
            self.access_token = data["access_token"]
            self.refresh_token = data["refresh_token"]
            # Update datadome from Set-Cookie
            set_cookie = response.headers.get("Set-Cookie", "")
            dd_match = re.search(r"datadome=([^;]+)", set_cookie)
            if dd_match:
                self.datadome_cookie = dd_match.group(1)
        else:
            print(f"  Token refresh failed ({response.status_code}), trying email login...")
            self.access_token = ""
            self.refresh_token = ""
            self._email_login()

    def _email_login(self) -> None:
        """Magic-link email login flow."""
        print(f"  Sending login email to {self.email}...")
        response = self._post(AUTH_BY_EMAIL_ENDPOINT, {
            "device_type": "ANDROID",
            "email": self.email,
        })
        if response.status_code != 200:
            raise RuntimeError(f"Login failed: {response.status_code} — {response.text[:200]}")

        data = response.json()
        if data.get("state") == "TERMS":
            raise RuntimeError(f"Email {self.email} is not linked to a TGTG account.")
        if data.get("state") != "WAIT":
            raise RuntimeError(f"Unexpected login state: {data}")

        polling_id = data["polling_id"]
        print("  Check your email and click the login link (on a computer, not phone)...")
        self._poll_for_login(polling_id)

    def _poll_for_login(self, polling_id: str) -> None:
        """Poll until user clicks magic link."""
        for i in range(MAX_POLLING_TRIES):
            response = self._post(AUTH_POLLING_ENDPOINT, {
                "device_type": "ANDROID",
                "email": self.email,
                "request_polling_id": polling_id,
            })
            if response.status_code == 202:
                print(f"  Waiting for email confirmation... ({(i+1)*POLLING_WAIT_TIME}s)")
                time.sleep(POLLING_WAIT_TIME)
                continue
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.refresh_token = data["refresh_token"]
                set_cookie = response.headers.get("Set-Cookie", "")
                dd_match = re.search(r"datadome=([^;]+)", set_cookie)
                if dd_match:
                    self.datadome_cookie = dd_match.group(1)
                print("  Logged in!")
                return
            raise RuntimeError(f"Polling failed: {response.status_code} — {response.text[:200]}")
        raise RuntimeError("Timed out waiting for email confirmation.")

    def get_items(self, *, latitude: float, longitude: float, radius: int = 21,
                  page_size: int = 400, favorites_only: bool = False,
                  with_stock_only: bool = False) -> list[dict]:
        """Fetch available bags near a location."""
        self.login()
        response = self._post(API_ITEM_ENDPOINT, {
            "origin": {"latitude": latitude, "longitude": longitude},
            "radius": radius,
            "page_size": page_size,
            "page": 1,
            "discover": False,
            "favorites_only": favorites_only,
            "item_categories": [],
            "diet_categories": [],
            "pickup_earliest": None,
            "pickup_latest": None,
            "search_phrase": None,
            "with_stock_only": with_stock_only,
            "hidden_only": False,
            "we_care_only": False,
        })
        if response.status_code == 200:
            items = response.json().get("items")
            return items if isinstance(items, list) else []
        raise RuntimeError(f"get_items failed: {response.status_code} — {response.text[:200]}")

    def get_credentials(self) -> dict:
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "datadome_cookie": self.datadome_cookie,
        }


def get_client(email: str) -> TgtgClient:
    """Return an authenticated TgtgClient, using cached creds when available."""
    load_dotenv(ENV_PATH)

    access_token = os.getenv("TGTG_ACCESS_TOKEN", "")
    refresh_token = os.getenv("TGTG_REFRESH_TOKEN", "")

    # Never reuse cached datadome cookie — always fetch fresh
    client = TgtgClient(
        email=email,
        access_token=access_token,
        refresh_token=refresh_token,
        datadome_cookie="",
    )
    return client


def save_credentials(client: TgtgClient, email: str) -> None:
    """Write current tokens back to .env for reuse."""
    creds = client.get_credentials()
    if not ENV_PATH.exists():
        ENV_PATH.touch()
    set_key(str(ENV_PATH), "TGTG_EMAIL", email)
    set_key(str(ENV_PATH), "TGTG_ACCESS_TOKEN", creds["access_token"])
    set_key(str(ENV_PATH), "TGTG_REFRESH_TOKEN", creds["refresh_token"])
    set_key(str(ENV_PATH), "TGTG_COOKIE", creds.get("datadome_cookie", ""))
