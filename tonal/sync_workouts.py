#!/usr/bin/env python3
"""
ToneGet - Tonal Workout Data Export v4.0.0

Download your personal Tonal workout history to a local JSON file.
Includes strength scores, custom workouts, and full set-by-set data.

Features:
  - Incremental sync (only fetch new workouts since last run)
  - Token caching (skip re-auth if token is still valid)
  - Env var / .env file credential loading
  - Retry logic with exponential backoff
  - Structured output directory with timestamped snapshots
  - Structured logging with configurable verbosity

Usage:
    python sync_workouts.py [options]

Options:
    --email EMAIL        Override email (highest priority)
    --password PASSWORD  Override password (highest priority)
    --full-sync          Force complete re-download (ignore incremental state)
    --output-dir DIR     Custom output directory (default: ./data relative to script)
    --no-gzip            Skip compression for snapshot
    --full               Include all raw API fields (no trimming)
    --quiet              Minimal output (WARNING level, for cron)
    --verbose            Debug output (DEBUG level)
    --dry-run            Authenticate and report stats, don't write any files

Output structure:
    {output_dir}/
      tonal_workouts_latest.json           cumulative, always up-to-date
      .token_cache.json                    cached auth token (gitignore this)
      .sync_state.json                     last sync timestamp (gitignore this)
      exports/
        tonal_workouts_20260221_103000.json.gz  timestamped snapshots

Requirements:
    pip install requests python-dotenv

DISCLAIMER: This is an unofficial tool, not affiliated with Tonal Systems, Inc.
Use at your own risk. See LICENSE for details.
"""

import argparse
import base64
import gzip
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from getpass import getpass
from typing import Any, Dict, List, Optional, Set

import requests
from dotenv import load_dotenv

__version__ = "4.0.0"

# Tonal's public OAuth2 client (used by their mobile app)
AUTH0_DOMAIN = "tonal.auth0.com"
CLIENT_ID = "ERCyexW-xoVG_Yy3RDe-eV4xsOnRHP6L"
API_BASE = "https://api.tonal.com"

# Known Tonal workout types (anything else is likely custom)
KNOWN_WORKOUT_TYPES = ['PROGRAM', 'ON_DEMAND', 'QUICK_FIT', 'LIVE', 'MOVEMENT', 'ASSESSMENT']

# Exit codes
EXIT_SUCCESS = 0
EXIT_AUTH_FAILURE = 1
EXIT_API_ERROR = 2
EXIT_NO_NEW_DATA = 3

logger = logging.getLogger("toneget")


# ============================================================================
# DATA TRIMMING
# Remove fields the dashboard doesn't use to reduce file size
# ============================================================================

SET_FIELDS_TO_REMOVE = [
    'beginTimeMCB', 'endTimeMCB',
    'romWeightMode', 'romWeight', 'romWeightFrac',
    'isoModeSpeed', 'dualMotorReps', 'suggestedResistanceLevel',
    'offMachineModifiedWeight', 'userWeightPounds', 'meanMaxPos',
    'velAtMaxConPower', 'weightAtMaxConPower',
    'inchesUpdated', 'powerUpdated',
    'triggeredFeedback', 'reps',
    'workoutActivityID', 'workoutId', 'userId', 'setId',
]

WORKOUT_FIELDS_TO_REMOVE = ['deletedAt']

USER_FIELDS_TO_REMOVE = [
    'recentMobileDevice', 'auth0Id', 'isGuestAccount', 'isDemoAccount',
    'watchedSafetyVideo', 'social', 'profileAssetID', 'mobileWorkoutsEnabled',
    'accountType', 'sharingCustomWorkoutsDisabled', 'workoutDurationMin',
    'workoutDurationMax', 'updatedPreferencesAt', 'primaryDeviceType',
    'emailVerified', 'workoutsPerWeek',
]


def trim_dict(data: dict, fields_to_remove: list) -> dict:
    """Remove specified fields from a dictionary."""
    return {k: v for k, v in data.items() if k not in fields_to_remove}


def trim_set(set_data: dict) -> dict:
    """Remove unused fields from a single set."""
    return trim_dict(set_data, SET_FIELDS_TO_REMOVE)


def trim_workout(workout: dict) -> dict:
    """Remove unused fields from a workout and its sets."""
    trimmed = trim_dict(workout, WORKOUT_FIELDS_TO_REMOVE)

    if 'workoutSetActivity' in trimmed:
        trimmed['workoutSetActivity'] = [
            trim_set(s) for s in trimmed['workoutSetActivity']
        ]

    return trimmed


def trim_export(data: dict) -> dict:
    """Trim entire export to remove unused fields."""
    trimmed = data.copy()

    if 'user' in trimmed and trimmed['user']:
        trimmed['user'] = trim_dict(trimmed['user'], USER_FIELDS_TO_REMOVE)

    if 'profile' in trimmed and trimmed['profile']:
        trimmed['profile'] = trim_dict(trimmed['profile'], USER_FIELDS_TO_REMOVE)

    if 'workouts' in trimmed:
        trimmed['workouts'] = [trim_workout(w) for w in trimmed['workouts']]

    return trimmed


# ============================================================================
# JWT PARSING (no external library)
# ============================================================================

def parse_jwt_exp(token: str) -> int:
    """Extract expiry timestamp from JWT without external library."""
    try:
        payload = token.split('.')[1]
        # Add padding to make base64 valid
        payload += '=' * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        return claims.get('exp', 0)
    except Exception:
        return 0


# ============================================================================
# TOKEN CACHE
# ============================================================================

def load_token_cache(cache_path: str, email: str) -> Optional[str]:
    """
    Load cached id_token if it exists, is for the right account, and is still valid.

    Returns id_token string if valid, None otherwise.
    """
    if not os.path.exists(cache_path):
        logger.debug("No token cache found at %s", cache_path)
        return None

    try:
        with open(cache_path, 'r') as f:
            cache = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.debug("Failed to read token cache: %s", e)
        return None

    cached_email = cache.get('email', '')
    if cached_email.lower() != email.lower():
        logger.debug("Token cache is for different email (%s), ignoring", cached_email)
        return None

    id_token = cache.get('id_token', '')
    if not id_token:
        return None

    expires_at = cache.get('expires_at', 0)
    now = int(time.time())
    safety_margin = 60  # seconds

    if expires_at - safety_margin <= now:
        logger.debug("Cached token expired (expires_at=%s, now=%s)", expires_at, now)
        return None

    remaining = expires_at - now
    logger.debug("Using cached token, valid for %d more seconds", remaining)
    return id_token


def save_token_cache(cache_path: str, id_token: str, email: str) -> None:
    """Save id_token to cache file."""
    expires_at = parse_jwt_exp(id_token)
    cache = {
        'id_token': id_token,
        'expires_at': expires_at,
        'email': email,
    }
    try:
        with open(cache_path, 'w') as f:
            json.dump(cache, f)
        logger.debug("Token cached to %s (expires_at=%s)", cache_path, expires_at)
    except OSError as e:
        logger.warning("Failed to save token cache: %s", e)


# ============================================================================
# SYNC STATE
# ============================================================================

def load_sync_state(state_path: str) -> dict:
    """Load sync state from file. Returns empty dict if not found or invalid."""
    if not os.path.exists(state_path):
        logger.debug("No sync state found at %s", state_path)
        return {}

    try:
        with open(state_path, 'r') as f:
            state = json.load(f)
        logger.debug("Loaded sync state: last_sync=%s", state.get('last_sync'))
        return state
    except (json.JSONDecodeError, OSError) as e:
        logger.debug("Failed to read sync state: %s", e)
        return {}


def save_sync_state(state_path: str, newest_begin_time: str, workout_count: int) -> None:
    """Save sync state after a successful sync."""
    state = {
        'last_sync': newest_begin_time,
        'last_workout_count': workout_count,
        'last_run': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    try:
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=2)
        logger.debug("Sync state saved to %s", state_path)
    except OSError as e:
        logger.warning("Failed to save sync state: %s", e)


# ============================================================================
# RETRY LOGIC
# ============================================================================

def retry_request(method: str, url: str, max_retries: int = 3, **kwargs) -> requests.Response:
    """
    Make HTTP request with retry logic and exponential backoff.

    method: 'get' or 'post'
    Returns response object on success.
    Raises requests.RequestException after max_retries exhausted.
    """
    fn = getattr(requests, method.lower())
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            response = fn(url, **kwargs)

            if response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 2 ** attempt))
                logger.warning(
                    "Rate limited (429). Waiting %d seconds before retry %d/%d...",
                    retry_after, attempt, max_retries
                )
                time.sleep(retry_after)
                continue

            return response

        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_exc = e
            if attempt < max_retries:
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s
                logger.warning(
                    "Request failed (attempt %d/%d): %s. Retrying in %ds...",
                    attempt, max_retries, e, wait
                )
                time.sleep(wait)
            else:
                logger.error("Request failed after %d attempts: %s", max_retries, e)

    if last_exc:
        raise last_exc
    raise requests.exceptions.RequestException(f"Failed after {max_retries} attempts: {url}")


# ============================================================================
# AUTHENTICATION & API
# ============================================================================

def authenticate(email: str, password: str) -> dict:
    """
    Authenticate with Tonal using OAuth2 Resource Owner Password Grant.

    This is the same authentication flow used by Tonal's mobile app.
    Credentials are sent directly to Tonal's Auth0 instance over HTTPS.
    """
    logger.info("Authenticating with Tonal...")

    try:
        response = retry_request(
            'post',
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "password",
                "client_id": CLIENT_ID,
                "username": email,
                "password": password,
                "scope": "openid profile email offline_access"
            },
            timeout=30
        )
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"Failed to connect to Tonal: {e}")

    if response.status_code == 401:
        raise ValueError("Invalid email or password")
    elif response.status_code == 403:
        raise PermissionError("Access denied. Your account may be locked or require verification.")
    elif response.status_code != 200:
        raise Exception(f"Authentication failed: {response.status_code} - {response.text}")

    logger.info("Authentication successful")
    return response.json()


def get_user_info(id_token: str) -> dict:
    """Get basic user info including user ID."""
    headers = {"Authorization": f"Bearer {id_token}"}
    response = retry_request('get', f"{API_BASE}/v6/users/userinfo", headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"Failed to get user info: {response.status_code}")

    return response.json()


def get_user_profile(id_token: str, user_id: str) -> dict:
    """Get user profile with stats like total workouts and volume."""
    headers = {"Authorization": f"Bearer {id_token}"}
    response = retry_request(
        'get',
        f"{API_BASE}/v6/users/{user_id}/profile",
        headers=headers,
        timeout=30
    )

    if response.status_code != 200:
        return {}

    return response.json()


def download_workouts(
    id_token: str,
    user_id: str,
    since_timestamp: Optional[str] = None,
) -> List[Dict[Any, Any]]:
    """
    Download workout activities using header-based pagination.

    Tonal's API uses custom headers (pg-offset, pg-limit, pg-total) for pagination.

    If since_timestamp is provided (ISO string), only workouts with beginTime
    strictly after that timestamp are returned. The API doesn't natively filter
    by date, so we fetch all pages until we hit workouts older than the cutoff.
    """
    all_workouts: List[dict] = []
    offset = 0
    limit = 100  # API maximum
    base_url = f"{API_BASE}/v6/users/{user_id}/workout-activities"
    cutoff = since_timestamp  # may be None (full sync)

    # First request to get total count
    headers = {
        "Authorization": f"Bearer {id_token}",
        "pg-offset": "0",
        "pg-limit": str(limit),
    }

    response = retry_request('get', base_url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch workouts: {response.status_code}")

    total = int(response.headers.get('pg-total', 0))

    if total == 0:
        logger.info("No workouts found on account.")
        return []

    if cutoff:
        logger.info("Incremental sync: fetching workouts newer than %s (total on server: %d)", cutoff, total)
    else:
        logger.info("Full sync: found %d workouts to download", total)

    # Process first batch (already fetched)
    batch = response.json()
    done = False
    for workout in batch:
        begin = workout.get('beginTime', '')
        if cutoff and begin <= cutoff:
            done = True
            break
        all_workouts.append(workout)

    offset += limit

    while not done and offset < total:
        # Build progress bar
        downloaded = min(offset, total)
        pct = (downloaded / total) * 100
        bar_len = 20
        filled = int(bar_len * downloaded / total)
        bar = "#" * filled + "-" * (bar_len - filled)
        logger.info("   [%s] %d/%d (%.0f%%)", bar, downloaded, total, pct)

        headers = {
            "Authorization": f"Bearer {id_token}",
            "pg-offset": str(offset),
            "pg-limit": str(limit),
        }

        try:
            response = retry_request('get', base_url, headers=headers, timeout=30)
        except requests.exceptions.RequestException as e:
            logger.warning("Error at offset %d: %s — skipping batch", offset, e)
            offset += limit
            continue

        if response.status_code != 200:
            logger.warning("Error at offset %d (HTTP %d) — skipping batch", offset, response.status_code)
            offset += limit
            continue

        batch = response.json()
        for workout in batch:
            begin = workout.get('beginTime', '')
            if cutoff and begin <= cutoff:
                done = True
                break
            all_workouts.append(workout)

        offset += limit

    logger.info("Downloaded %d workout(s)", len(all_workouts))
    return all_workouts


def get_workout_template(id_token: str, workout_id: str) -> Optional[dict]:
    """Fetch a single workout template by ID (for custom workouts)."""
    headers = {"Authorization": f"Bearer {id_token}"}
    response = retry_request(
        'get',
        f"{API_BASE}/v6/workouts/{workout_id}",
        headers=headers,
        timeout=30
    )

    if response.status_code != 200:
        return None

    return response.json()


def fetch_custom_workouts(id_token: str, workouts: List[dict]) -> Dict[str, dict]:
    """
    Fetch details for custom workout templates.

    Custom workouts are user-created and need to be fetched individually
    to get their names and structure.
    """
    custom_ids: Set[str] = set()

    for workout in workouts:
        workout_type = workout.get('workoutType', '')
        template_id = workout.get('workoutId')

        if template_id:
            if workout_type == 'Custom' or workout_type not in KNOWN_WORKOUT_TYPES:
                custom_ids.add(template_id)

    if not custom_ids:
        return {}

    logger.info("Fetching %d custom workout template(s)...", len(custom_ids))

    custom_workouts = {}
    for i, workout_id in enumerate(custom_ids, 1):
        details = get_workout_template(id_token, workout_id)
        if details:
            custom_workouts[workout_id] = {
                "id": details.get("id"),
                "title": details.get("title"),
                "userId": details.get("userId"),
            }

        if i % 10 == 0:
            logger.info("   Fetched %d/%d custom templates...", i, len(custom_ids))

    logger.info("Fetched %d custom workout detail(s)", len(custom_workouts))
    return custom_workouts


def get_strength_score_history(id_token: str, user_id: str) -> List[dict]:
    """Fetch complete strength score history."""
    logger.info("Fetching Strength Score history...")

    headers = {"Authorization": f"Bearer {id_token}"}
    today = datetime.now().strftime('%Y-%m-%d')

    response = retry_request(
        'get',
        f"{API_BASE}/v6/users/{user_id}/strength-scores/history",
        headers=headers,
        params={'limit': 5000, 'endDate': today},
        timeout=30
    )

    if response.status_code != 200:
        logger.warning("Failed to fetch strength score history: HTTP %d", response.status_code)
        return []

    history = response.json()

    if history:
        logger.info("Got %d strength score entries", len(history))
        latest = history[0] if history else None
        if latest:
            logger.info("Current Score: %s", latest.get('overall', 'N/A'))
    else:
        logger.warning("No strength score history found")

    return history


def get_current_strength_scores(id_token: str, user_id: str) -> dict:
    """
    Fetch current strength scores with granular muscle group breakdown.

    Returns both raw API response and parsed format for easier use.
    """
    logger.info("Fetching granular Strength Score breakdown...")

    headers = {"Authorization": f"Bearer {id_token}"}

    response = retry_request(
        'get',
        f"{API_BASE}/v6/users/{user_id}/strength-scores/current",
        headers=headers,
        timeout=30
    )

    if response.status_code != 200:
        logger.warning("Failed to fetch current strength scores: HTTP %d", response.status_code)
        return {}

    data = response.json()

    if isinstance(data, list) and len(data) > 0:
        logger.info("Got granular strength score data")

        parsed: Dict[str, Any] = {
            'regions': {},
            'muscles': {}
        }

        for region in data:
            region_name = region.get('strengthBodyRegion', 'Unknown')
            region_score = region.get('score', 0)

            parsed['regions'][region_name] = region_score

            for muscle in region.get('familyActivity', []):
                muscle_name = muscle.get('strengthFamily', 'Unknown')
                muscle_score = muscle.get('score', 0)
                parsed['muscles'][muscle_name] = {
                    'score': round(muscle_score),
                    'region': region_name,
                    'updatedAt': muscle.get('updatedAt')
                }

        if 'Overall' in parsed['regions']:
            logger.info("Overall strength score: %s", parsed['regions']['Overall'])

        return {
            'raw': data,
            'parsed': parsed
        }
    else:
        logger.warning("No granular strength score data found")
        return {}


# ============================================================================
# FILE OUTPUT
# ============================================================================

def format_size(size_bytes: int) -> str:
    """Format bytes as human-readable size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def load_latest(latest_path: str) -> List[dict]:
    """Load existing cumulative workouts from latest.json. Returns empty list on failure."""
    if not os.path.exists(latest_path):
        logger.debug("No existing latest.json at %s", latest_path)
        return []

    try:
        with open(latest_path, 'r') as f:
            data = json.load(f)
        workouts = data.get('workouts', [])
        logger.debug("Loaded %d existing workouts from latest.json", len(workouts))
        return workouts
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load latest.json: %s — treating as empty", e)
        return []


def merge_workouts(existing: List[dict], new: List[dict]) -> List[dict]:
    """
    Merge new workouts into existing list, deduplicating by workout id.
    Returns list sorted newest-first by beginTime.
    """
    merged: Dict[str, dict] = {w['id']: w for w in existing if 'id' in w}
    added = 0
    for w in new:
        wid = w.get('id')
        if wid and wid not in merged:
            merged[wid] = w
            added += 1

    result = sorted(merged.values(), key=lambda x: x.get('beginTime', ''), reverse=True)
    logger.debug("Merged %d new workouts into %d existing → %d total", added, len(existing), len(result))
    return result


def save_latest(latest_path: str, export_data: dict, trim: bool) -> None:
    """Save cumulative latest.json (always uncompressed for easy access)."""
    output_data = trim_export(export_data) if trim else export_data
    json_str = json.dumps(output_data, separators=(',', ':'))

    with open(latest_path, 'w', encoding='utf-8') as f:
        f.write(json_str)

    size = len(json_str.encode('utf-8'))
    logger.info("Saved cumulative latest.json (%s)", format_size(size))


def save_snapshot(exports_dir: str, export_data: dict, trim: bool, use_gzip: bool) -> dict:
    """
    Save a timestamped snapshot to exports/.

    Returns dict with filename(s) and size(s).
    """
    results = {}

    output_data = trim_export(export_data) if trim else export_data
    json_str = json.dumps(output_data, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = f"tonal_workouts_{timestamp}"

    if use_gzip:
        gz_path = os.path.join(exports_dir, f"{base_name}.json.gz")
        with gzip.open(gz_path, 'wb', compresslevel=9) as f:
            f.write(json_bytes)

        gz_size = os.path.getsize(gz_path)
        raw_size = len(json_bytes)
        ratio = (1 - gz_size / raw_size) * 100 if raw_size else 0

        results['gzip'] = {
            'filename': gz_path,
            'size': gz_size,
            'compression_ratio': ratio,
        }
        logger.info(
            "Saved snapshot: %s (%s, %.0f%% compression)",
            os.path.basename(gz_path), format_size(gz_size), ratio
        )
    else:
        json_path = os.path.join(exports_dir, f"{base_name}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            f.write(json_str)

        json_size = len(json_bytes)
        results['json'] = {
            'filename': json_path,
            'size': json_size,
        }
        logger.info("Saved snapshot: %s (%s)", os.path.basename(json_path), format_size(json_size))

    return results


def print_summary(workouts: List[dict], custom_workouts: dict, strength_history: List[dict]) -> None:
    """Log summary statistics."""
    total_volume = sum(w.get('totalVolume', 0) for w in workouts)
    total_reps = sum(w.get('totalReps', 0) for w in workouts)
    dates = [w.get('beginTime') for w in workouts if w.get('beginTime')]

    logger.info("=" * 50)
    logger.info("YOUR DATA")
    logger.info("=" * 50)
    logger.info("  Workouts:        %d", len(workouts))
    if custom_workouts:
        logger.info("  Custom Workouts: %d", len(custom_workouts))
    logger.info("  Total Volume:    %s lbs", f"{total_volume:,}")
    logger.info("  Total Reps:      %s", f"{total_reps:,}")
    if dates:
        logger.info("  Date Range:      %s -> %s", min(dates)[:10], max(dates)[:10])

    if strength_history:
        latest = strength_history[0]
        logger.info("  Strength Score:  %s", latest.get('overall', 'N/A'))
        upper = latest.get('upper', 'N/A')
        lower = latest.get('lower', 'N/A')
        core = latest.get('core', 'N/A')
        logger.info("    Upper: %s | Lower: %s | Core: %s", upper, lower, core)


# ============================================================================
# CREDENTIAL RESOLUTION
# ============================================================================

def resolve_credentials(args: argparse.Namespace) -> tuple:
    """
    Resolve email and password with priority order:
      1. CLI args (--email / --password)
      2. Environment variables (TONAL_EMAIL / TONAL_PASSWORD)
      3. .env file (loaded via python-dotenv from script directory)
      4. Interactive prompt (fallback)

    Returns (email, password) tuple.
    """
    # Load .env file (does not override already-set env vars)
    dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(dotenv_path)

    email = getattr(args, 'email', None) or os.environ.get('TONAL_EMAIL', '').strip()
    password = getattr(args, 'password', None) or os.environ.get('TONAL_PASSWORD', '').strip()

    if not email:
        email = input("Tonal email: ").strip()
    if not password:
        password = getpass("Tonal password: ")

    if not email:
        logger.error("Email is required")
        sys.exit(EXIT_AUTH_FAILURE)
    if not password:
        logger.error("Password is required")
        sys.exit(EXIT_AUTH_FAILURE)

    return email, password


# ============================================================================
# CLI ARGUMENT PARSING
# ============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='sync_workouts.py',
        description=f'ToneGet v{__version__} - Export your Tonal workout data',
    )
    parser.add_argument('--email', help='Override email (highest priority)')
    parser.add_argument('--password', help='Override password (highest priority)')
    parser.add_argument(
        '--full-sync',
        action='store_true',
        help='Force complete re-download (ignore incremental state)',
    )
    parser.add_argument(
        '--output-dir',
        default=None,
        metavar='DIR',
        help='Custom output directory (default: ./data relative to script)',
    )
    parser.add_argument(
        '--no-gzip',
        action='store_true',
        help='Skip compression for snapshot',
    )
    parser.add_argument(
        '--full',
        action='store_true',
        help='Include all raw API fields (no trimming)',
    )
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Minimal output (WARNING level) — suitable for cron',
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Debug output (DEBUG level)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Authenticate and report stats, do not write any files',
    )
    return parser


# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(quiet: bool, verbose: bool) -> None:
    """Configure logging based on verbosity flags."""
    if verbose:
        level = logging.DEBUG
    elif quiet:
        level = logging.WARNING
    else:
        level = logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    handler.setLevel(level)
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
    handler.setFormatter(formatter)

    root = logging.getLogger("toneget")
    root.setLevel(level)
    root.addHandler(handler)


# ============================================================================
# MAIN
# ============================================================================

def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    setup_logging(quiet=args.quiet, verbose=args.verbose)

    logger.info("=" * 50)
    logger.info("TONEGET v%s — Export your Tonal workout data", __version__)
    logger.info("=" * 50)
    logger.info("Disclaimer: Unofficial tool, not affiliated with Tonal Systems, Inc.")

    if args.full:
        logger.info("Mode: FULL (all raw fields, larger file)")
    else:
        logger.info("Mode: Optimized (trimmed for smaller files)")

    if args.dry_run:
        logger.info("DRY RUN enabled — no files will be written")

    # Resolve output directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = args.output_dir if args.output_dir else os.path.join(script_dir, 'data')
    exports_dir = os.path.join(output_dir, 'exports')

    if not args.dry_run:
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(exports_dir, exist_ok=True)
        logger.debug("Output directory: %s", output_dir)

    # Paths for persistent state
    token_cache_path = os.path.join(output_dir, '.token_cache.json')
    sync_state_path = os.path.join(output_dir, '.sync_state.json')
    latest_path = os.path.join(output_dir, 'tonal_workouts_latest.json')

    # Resolve credentials
    email, password = resolve_credentials(args)

    # Attempt to use cached token
    id_token: Optional[str] = None
    if not args.dry_run:
        id_token = load_token_cache(token_cache_path, email)

    if id_token:
        logger.info("Using cached auth token (skipping re-authentication)")
    else:
        try:
            tokens = authenticate(email, password)
            id_token = tokens.get("id_token")
            if not id_token:
                logger.error("Authentication response missing id_token")
                sys.exit(EXIT_AUTH_FAILURE)
            if not args.dry_run:
                save_token_cache(token_cache_path, id_token, email)
        except (ValueError, PermissionError) as e:
            logger.error("Authentication failed: %s", e)
            sys.exit(EXIT_AUTH_FAILURE)
        except (ConnectionError, Exception) as e:
            logger.error("Authentication error: %s", e)
            sys.exit(EXIT_AUTH_FAILURE)

    # Get user info
    try:
        user_info = get_user_info(id_token)
    except Exception as e:
        logger.error("Failed to get user info: %s", e)
        sys.exit(EXIT_API_ERROR)

    user_id = user_info.get("id")
    first = user_info.get('firstName', '')
    last = user_info.get('lastName', '')
    logger.info("Logged in as: %s %s", first, last)

    # Get profile
    try:
        profile = get_user_profile(id_token, user_id)
    except Exception:
        profile = {}

    if profile.get('totalWorkouts'):
        logger.info("Total workouts on record: %d", profile.get('totalWorkouts'))

    # Dry run: report stats and exit
    if args.dry_run:
        logger.info("Dry run complete. No files written.")
        sys.exit(EXIT_SUCCESS)

    # Incremental sync: determine since_timestamp
    since_timestamp: Optional[str] = None
    if not args.full_sync:
        sync_state = load_sync_state(sync_state_path)
        since_timestamp = sync_state.get('last_sync')
        if since_timestamp:
            logger.info("Incremental sync since: %s", since_timestamp)
        else:
            logger.info("No prior sync state found — performing full sync")
    else:
        logger.info("--full-sync specified — performing full sync")

    # Download workouts
    try:
        new_workouts = download_workouts(id_token, user_id, since_timestamp=since_timestamp)
    except Exception as e:
        logger.error("Failed to download workouts: %s", e)
        sys.exit(EXIT_API_ERROR)

    # Incremental: check if anything new
    if since_timestamp and not new_workouts:
        logger.info("No new workouts since last sync (%s)", since_timestamp)
        sys.exit(EXIT_NO_NEW_DATA)

    if not new_workouts and not since_timestamp:
        logger.info("No workouts found on account — nothing to export")
        sys.exit(EXIT_SUCCESS)

    # Fetch supplemental data for the new workouts
    try:
        custom_workouts = fetch_custom_workouts(id_token, new_workouts)
    except Exception as e:
        logger.warning("Failed to fetch custom workouts: %s", e)
        custom_workouts = {}

    try:
        strength_history = get_strength_score_history(id_token, user_id)
    except Exception as e:
        logger.warning("Failed to fetch strength score history: %s", e)
        strength_history = []

    try:
        current_strength = get_current_strength_scores(id_token, user_id)
    except Exception as e:
        logger.warning("Failed to fetch current strength scores: %s", e)
        current_strength = {}

    # Merge workouts into cumulative set
    if since_timestamp:
        existing_workouts = load_latest(latest_path)
        all_workouts = merge_workouts(existing_workouts, new_workouts)
        logger.info(
            "Merged %d new workouts into %d existing — %d total",
            len(new_workouts), len(existing_workouts), len(all_workouts)
        )
    else:
        # Full sync: sort newest-first
        all_workouts = sorted(new_workouts, key=lambda x: x.get('beginTime', ''), reverse=True)

    # Build export payload
    export_data = {
        'version': '4.0',
        'exportedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'exportedWith': f'ToneGet v{__version__}',
        'user': user_info,
        'profile': profile,
        'workouts': all_workouts,
        'customWorkouts': custom_workouts,
        'strengthScoreHistory': strength_history,
        'currentStrengthScores': current_strength,
    }

    use_gzip = not args.no_gzip
    trim = not args.full

    # Save cumulative latest.json
    try:
        save_latest(latest_path, export_data, trim=trim)
    except OSError as e:
        logger.error("Failed to save latest.json: %s", e)
        sys.exit(EXIT_API_ERROR)

    # Save timestamped snapshot
    try:
        save_snapshot(exports_dir, export_data, trim=trim, use_gzip=use_gzip)
    except OSError as e:
        logger.error("Failed to save snapshot: %s", e)
        sys.exit(EXIT_API_ERROR)

    # Update sync state (use beginTime of the newest workout in the full set)
    newest_begin = all_workouts[0].get('beginTime', '') if all_workouts else ''
    if newest_begin:
        save_sync_state(sync_state_path, newest_begin, len(all_workouts))

    # Print summary
    print_summary(all_workouts, custom_workouts, strength_history)

    logger.info("=" * 50)
    logger.info("EXPORT COMPLETE")
    logger.info("=" * 50)
    logger.info("Output directory: %s", output_dir)
    logger.info("Your Tonal workout data has been exported.")

    sys.exit(EXIT_SUCCESS)


if __name__ == "__main__":
    main()
