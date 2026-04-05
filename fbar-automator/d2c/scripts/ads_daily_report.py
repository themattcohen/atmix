"""
ads_daily_report.py — FBAR Direct Google Ads Daily Performance Report

Pulls data from two sources and writes a Markdown report to:
  fbar-automator/d2c/claudedocs/ads-reports/YYYY-MM-DD.md

Usage:
  python ads_daily_report.py                  # yesterday's data
  python ads_daily_report.py --date 2026-04-01  # specific date
  python ads_daily_report.py --days 7          # last 7 days summary

Data sources:
  1. GA4 Data API (google-analytics-data) — traffic, funnel, device breakdown
  2. Postgres via SSH tunnel to production Hetzner VPS — signups, filings, revenue

Google Ads metrics (impressions, clicks, spend, CPC) are pulled automatically
from GA4 via the cost data import link (GA4 ↔ Google Ads product link).
If the link data hasn't propagated yet, the report shows a placeholder.

Setup:
  pip install -r requirements-ads.txt
  export GA4_PROPERTY_ID=12345678
  export D2C_DATABASE_URL=postgresql://user:pass@localhost/fbar_direct
     OR
  export POSTGRES_USER=...
  export POSTGRES_PASSWORD=...
  export POSTGRES_DB=fbar_direct   (optional, defaults to fbar_direct)

The SSH tunnel is opened automatically using the key at ~/.ssh/ebay-tracker-hetzner.
"""

from __future__ import annotations

import argparse
import os
import sys
import textwrap
import zoneinfo
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

MT = zoneinfo.ZoneInfo("America/Denver")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_D2C = SCRIPT_DIR.parent
SECRETS_DIR = REPO_D2C / "secrets"
GA4_SERVICE_ACCOUNT_KEY = SECRETS_DIR / "ga4-service-account.json"
REPORTS_DIR = REPO_D2C / "claudedocs" / "ads-reports"

# ---------------------------------------------------------------------------
# Campaign constants
# ---------------------------------------------------------------------------
CAMPAIGN_START = date(2026, 3, 31)
CAMPAIGN_END = date(2026, 4, 15)
CAMPAIGN_DURATION_DAYS = (CAMPAIGN_END - CAMPAIGN_START).days + 1
CAMPAIGN_NAME = "FBAR Filing Search"
GOOGLE_ADS_ACCOUNT = "217-281-2717"
PRICE_BASIC = 59
PRICE_PREMIUM = 79
BREAK_EVEN_CPA = 63  # approximate weighted average

SSH_HOST = "178.156.250.116"
SSH_USER = "root"
SSH_KEY = Path.home() / ".ssh" / "hetzner_claude"
SSH_REMOTE_PORT = 5432
SSH_LOCAL_PORT = 15432


# ---------------------------------------------------------------------------
# GA4 helpers
# ---------------------------------------------------------------------------

def _ga4_client():
    """Return an authenticated GA4 BetaAnalyticsDataClient or None."""
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account
    except ImportError:
        print("[GA4] google-analytics-data not installed — skipping GA4 queries.")
        return None

    if not GA4_SERVICE_ACCOUNT_KEY.exists():
        print(f"[GA4] Service account key not found at {GA4_SERVICE_ACCOUNT_KEY} — skipping.")
        return None

    try:
        creds = service_account.Credentials.from_service_account_file(
            str(GA4_SERVICE_ACCOUNT_KEY),
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        return BetaAnalyticsDataClient(credentials=creds)
    except Exception as exc:
        print(f"[GA4] Failed to create client: {exc}")
        return None


def _property_id() -> str | None:
    pid = os.environ.get("GA4_PROPERTY_ID", "526359158").strip()
    if not pid:
        print("[GA4] GA4_PROPERTY_ID env var not set — skipping GA4 queries.")
        return None
    return pid


def _date_range(report_date: date, days: int = 1):
    """Return (start_str, end_str) for a GA4 DateRange."""
    end = report_date
    start = report_date - timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


def _run_ga4_report(client, property_id: str, request) -> Any | None:
    """Run a GA4 RunReportRequest, returning the response or None on error."""
    try:
        return client.run_report(request)
    except Exception as exc:
        print(f"[GA4] Query failed: {exc}")
        return None


def fetch_ga4_data(report_date: date, days: int = 1) -> dict:
    """
    Run all GA4 queries and return a structured dict with results.
    Returns partial data if some queries fail; empty dict if GA4 unavailable.
    """
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Filter,
        FilterExpression,
        FilterExpressionList,
        Metric,
        OrderBy,
        RunReportRequest,
    )

    client = _ga4_client()
    pid = _property_id()
    if client is None or pid is None:
        return {}

    property_path = f"properties/{pid}"
    start, end = _date_range(report_date, days)
    date_range = DateRange(start_date=start, end_date=end)

    # Shared filter: source=google, medium=cpc
    google_cpc_filter = FilterExpression(
        and_group=FilterExpressionList(
            expressions=[
                FilterExpression(
                    filter=Filter(
                        field_name="sessionSource",
                        string_filter=Filter.StringFilter(value="google"),
                    )
                ),
                FilterExpression(
                    filter=Filter(
                        field_name="sessionMedium",
                        string_filter=Filter.StringFilter(value="cpc"),
                    )
                ),
            ]
        )
    )

    results: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # 1. Sessions by source/medium (paid traffic volume)
    # ------------------------------------------------------------------
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[
                Dimension(name="sessionSource"),
                Dimension(name="sessionMedium"),
            ],
            metrics=[
                Metric(name="sessions"),
                Metric(name="newUsers"),
                Metric(name="engagementRate"),
                Metric(name="bounceRate"),
            ],
            dimension_filter=google_cpc_filter,
        ),
    )
    if resp:
        rows = []
        for row in resp.rows:
            rows.append(
                {
                    "source": row.dimension_values[0].value,
                    "medium": row.dimension_values[1].value,
                    "sessions": int(row.metric_values[0].value or 0),
                    "new_users": int(row.metric_values[1].value or 0),
                    "engagement_rate": float(row.metric_values[2].value or 0),
                    "bounce_rate": float(row.metric_values[3].value or 0),
                }
            )
        results["sessions_by_source"] = rows

    # ------------------------------------------------------------------
    # 2. Pageviews by landing page (paid traffic)
    # ------------------------------------------------------------------
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[Dimension(name="landingPage")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="screenPageViews"),
                Metric(name="bounceRate"),
            ],
            dimension_filter=google_cpc_filter,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=10,
        ),
    )
    if resp:
        rows = []
        for row in resp.rows:
            rows.append(
                {
                    "page": row.dimension_values[0].value,
                    "sessions": int(row.metric_values[0].value or 0),
                    "pageviews": int(row.metric_values[1].value or 0),
                    "bounce_rate": float(row.metric_values[2].value or 0),
                }
            )
        results["landing_pages"] = rows

    # ------------------------------------------------------------------
    # 3. Funnel events (paid traffic)
    # ------------------------------------------------------------------
    event_filter = FilterExpression(
        and_group=FilterExpressionList(
            expressions=[
                google_cpc_filter,
                FilterExpression(
                    filter=Filter(
                        field_name="eventName",
                        in_list_filter=Filter.InListFilter(
                            values=[
                                "fbar_step_view",
                                "fbar_step_complete",
                                "begin_checkout",
                                "purchase",
                            ]
                        ),
                    )
                ),
            ]
        )
    )
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[Dimension(name="eventName")],
            metrics=[Metric(name="eventCount")],
            dimension_filter=event_filter,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
        ),
    )
    if resp:
        funnel: dict[str, int] = {}
        for row in resp.rows:
            funnel[row.dimension_values[0].value] = int(row.metric_values[0].value or 0)
        results["funnel_events"] = funnel

    # ------------------------------------------------------------------
    # 4. Page-level funnel breakdown (using pagePath instead of custom dim)
    #    Funnel pages: /threshold, /personal, /accounts, /review, /sign, /payment, /confirmation
    # ------------------------------------------------------------------
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[
                Dimension(name="pagePath"),
            ],
            metrics=[Metric(name="sessions"), Metric(name="screenPageViews")],
            dimension_filter=google_cpc_filter,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        ),
    )
    if resp:
        funnel_pages = ["/threshold", "/personal", "/accounts", "/review", "/sign", "/payment", "/confirmation", "/signup"]
        steps = []
        for row in resp.rows:
            page = row.dimension_values[0].value
            if any(page.startswith(fp) or page == fp for fp in funnel_pages):
                steps.append(
                    {
                        "step": page,
                        "views": int(row.metric_values[1].value or 0),
                }
            )
        results["step_views"] = steps

    # ------------------------------------------------------------------
    # 5. Device breakdown (paid traffic)
    # ------------------------------------------------------------------
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[Dimension(name="deviceCategory")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="newUsers"),
                Metric(name="engagementRate"),
            ],
            dimension_filter=google_cpc_filter,
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        ),
    )
    if resp:
        devices = []
        for row in resp.rows:
            devices.append(
                {
                    "device": row.dimension_values[0].value,
                    "sessions": int(row.metric_values[0].value or 0),
                    "new_users": int(row.metric_values[1].value or 0),
                    "engagement_rate": float(row.metric_values[2].value or 0),
                }
            )
        results["devices"] = devices

    # ------------------------------------------------------------------
    # 6. New vs returning (paid traffic)
    # ------------------------------------------------------------------
    resp = _run_ga4_report(
        client,
        property_path,
        RunReportRequest(
            property=property_path,
            date_ranges=[date_range],
            dimensions=[Dimension(name="newVsReturning")],
            metrics=[Metric(name="sessions"), Metric(name="engagementRate")],
            dimension_filter=google_cpc_filter,
        ),
    )
    if resp:
        nvrmap = {}
        for row in resp.rows:
            nvrmap[row.dimension_values[0].value] = {
                "sessions": int(row.metric_values[0].value or 0),
                "engagement_rate": float(row.metric_values[1].value or 0),
            }
        results["new_vs_returning"] = nvrmap

    # ------------------------------------------------------------------
    # 7. Google Ads cost data (requires GA4 ↔ Google Ads product link)
    # ------------------------------------------------------------------
    try:
        resp = _run_ga4_report(
            client,
            property_path,
            RunReportRequest(
                property=property_path,
                date_ranges=[date_range],
                dimensions=[
                    Dimension(name="sessionGoogleAdsCampaignName"),
                    Dimension(name="sessionGoogleAdsAdGroupName"),
                ],
                metrics=[
                    Metric(name="advertiserAdImpressions"),
                    Metric(name="advertiserAdClicks"),
                    Metric(name="advertiserAdCost"),
                    Metric(name="advertiserAdCostPerClick"),
                ],
            ),
        )
        if resp and resp.rows:
            ads_rows = []
            for row in resp.rows:
                ads_rows.append({
                    "campaign": row.dimension_values[0].value,
                    "ad_group": row.dimension_values[1].value,
                    "impressions": int(float(row.metric_values[0].value or 0)),
                    "clicks": int(float(row.metric_values[1].value or 0)),
                    "cost": float(row.metric_values[2].value or 0),
                    "cpc": float(row.metric_values[3].value or 0),
                })
            results["ads_cost_data"] = ads_rows
            print(f"[GA4] Google Ads cost data: {len(ads_rows)} ad group(s)")
        else:
            print("[GA4] No Google Ads cost data yet (link may need 24-48h to propagate)")
    except Exception as exc:
        print(f"[GA4] Google Ads cost query failed (link may not be active yet): {exc}")

    return results


# ---------------------------------------------------------------------------
# Postgres / SSH tunnel helpers
# ---------------------------------------------------------------------------

def _parse_database_url(url: str) -> dict:
    """Parse a postgres:// URL into connection kwargs."""
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "dbname": parsed.path.lstrip("/") or "fbar_direct",
        "user": parsed.username,
        "password": parsed.password,
    }


def _db_connect_params() -> dict | None:
    """
    Return psycopg2 connection kwargs for the tunnelled DB.
    Priority: D2C_DATABASE_URL → DATABASE_URL → POSTGRES_USER/POSTGRES_PASSWORD.
    Always points to localhost:SSH_LOCAL_PORT (the tunnel endpoint).
    """
    url = os.environ.get("D2C_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        params = _parse_database_url(url)
        params["host"] = "localhost"
        params["port"] = SSH_LOCAL_PORT
        return params

    user = os.environ.get("POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD")
    dbname = os.environ.get("POSTGRES_DB", "fbar_direct")
    if user and password:
        return {
            "host": "localhost",
            "port": SSH_LOCAL_PORT,
            "dbname": dbname,
            "user": user,
            "password": password,
        }

    print(
        "[Postgres] No database credentials found.\n"
        "  Set D2C_DATABASE_URL, DATABASE_URL, or POSTGRES_USER + POSTGRES_PASSWORD."
    )
    return None


@contextmanager
def _ssh_tunnel():
    """
    Open an SSH tunnel from localhost:SSH_LOCAL_PORT → SSH_HOST:SSH_REMOTE_PORT.
    Yields a live SSHTunnelForwarder (already started) or None if unavailable.
    """
    import subprocess
    import time

    if not SSH_KEY.exists():
        print(f"[Postgres] SSH key not found at {SSH_KEY} — skipping Postgres queries.")
        yield None
        return

    # Use subprocess ssh -L for tunnel (avoids paramiko/sshtunnel compatibility issues)
    cmd = [
        "ssh", "-i", str(SSH_KEY),
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "-N", "-f",
        "-L", f"{SSH_LOCAL_PORT}:127.0.0.1:{SSH_REMOTE_PORT}",
        f"{SSH_USER}@{SSH_HOST}",
    ]
    proc = None
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(1.5)  # wait for tunnel to establish
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode() if proc.stderr else ""
            print(f"[Postgres] SSH tunnel failed to start: {stderr}")
            yield None
            return
        print(f"[Postgres] SSH tunnel open: localhost:{SSH_LOCAL_PORT} -> {SSH_HOST}:{SSH_REMOTE_PORT}")
        yield proc
    except Exception as exc:
        print(f"[Postgres] Could not open SSH tunnel: {exc}")
        yield None
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            proc.wait(timeout=5)
            print("[Postgres] SSH tunnel closed.")


def _run_remote_sql(query: str) -> list[dict]:
    """Run a SQL query on prod Postgres via SSH + docker exec. Returns list of dicts."""
    import csv
    import io
    import subprocess

    if not SSH_KEY.exists():
        return []

    # Use psql CSV output for easy parsing
    docker_cmd = (
        f'docker compose -f /opt/fbar/fbar-automator/docker-compose.prod.yml '
        f'exec -T postgres psql -U fbar -d fbar_direct --csv -c "{query}"'
    )
    cmd = [
        "ssh", "-i", str(SSH_KEY),
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        f"{SSH_USER}@{SSH_HOST}",
        docker_cmd,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode != 0:
            stderr = result.stderr.strip()
            # Filter out Docker compose warnings
            real_errors = [l for l in stderr.split("\n") if "variable is not set" not in l and l.strip()]
            if real_errors:
                print(f"[Postgres] Query error: {' '.join(real_errors)}")
            return []
        # Filter out Docker compose warnings from stdout too
        lines = [l for l in result.stdout.strip().split("\n") if "variable is not set" not in l]
        output = "\n".join(lines)
        if not output:
            return []
        reader = csv.DictReader(io.StringIO(output))
        return [dict(row) for row in reader]
    except subprocess.TimeoutExpired:
        print("[Postgres] Query timed out.")
        return []
    except Exception as exc:
        print(f"[Postgres] Error: {exc}")
        return []


def fetch_postgres_data(report_date: date) -> dict:
    """
    Run all Postgres queries via SSH + docker exec.
    Returns a dict with results; empty dict if unreachable.
    """
    if not SSH_KEY.exists():
        print(f"[Postgres] SSH key not found at {SSH_KEY} -- skipping.")
        return {}

    results: dict[str, Any] = {}

    # 1. New signups from google/cpc (recent)
    rows = _run_remote_sql(
        "SELECT COUNT(*) AS count, DATE(\\\"createdAt\\\") AS day "
        "FROM \\\"User\\\" "
        "WHERE \\\"utmSource\\\" = 'google' AND \\\"utmMedium\\\" = 'cpc' "
        "AND \\\"createdAt\\\" >= CURRENT_DATE - INTERVAL '2 days' "
        "GROUP BY day ORDER BY day"
    )
    if rows:
        results["signups_by_day"] = [{"count": int(r["count"]), "day": r["day"]} for r in rows]
        print(f"[Postgres] Recent paid signups: {rows}")

    # 2. All-time signups from google/cpc
    rows = _run_remote_sql(
        "SELECT COUNT(*) AS total FROM \\\"User\\\" "
        "WHERE \\\"utmSource\\\" = 'google' AND \\\"utmMedium\\\" = 'cpc'"
    )
    results["total_paid_signups"] = int(rows[0]["total"]) if rows else 0

    # 3. Filing status for paid-traffic users
    rows = _run_remote_sql(
        "SELECT fy.status, COUNT(*) AS count "
        "FROM \\\"FilingYear\\\" fy JOIN \\\"User\\\" u ON fy.\\\"userId\\\" = u.id "
        "WHERE u.\\\"utmSource\\\" = 'google' AND u.\\\"utmMedium\\\" = 'cpc' "
        "GROUP BY fy.status ORDER BY count DESC"
    )
    if rows:
        results["filing_status"] = [{"status": r["status"], "count": int(r["count"])} for r in rows]

    # 4. Revenue from paid traffic
    rows = _run_remote_sql(
        "SELECT COALESCE(SUM(p.amount), 0) AS revenue, COUNT(*) AS payments "
        "FROM \\\"Payment\\\" p "
        "JOIN \\\"FilingYear\\\" fy ON p.\\\"filingYearId\\\" = fy.id "
        "JOIN \\\"User\\\" u ON fy.\\\"userId\\\" = u.id "
        "WHERE p.status = 'COMPLETED' AND u.\\\"utmSource\\\" = 'google' AND u.\\\"utmMedium\\\" = 'cpc'"
    )
    if rows:
        results["paid_revenue"] = {
            "revenue": float(rows[0].get("revenue", 0)),
            "payments": int(rows[0].get("payments", 0)),
        }

    # 5. All-time platform totals
    rows = _run_remote_sql("SELECT COUNT(*) AS n FROM \\\"User\\\"")
    results["total_users"] = int(rows[0]["n"]) if rows else 0

    rows = _run_remote_sql("SELECT COUNT(*) AS n FROM \\\"FilingYear\\\"")
    results["total_filings"] = int(rows[0]["n"]) if rows else 0

    rows = _run_remote_sql(
        "SELECT COALESCE(SUM(amount), 0) AS total_revenue "
        "FROM \\\"Payment\\\" WHERE status = 'COMPLETED'"
    )
    results["total_revenue"] = float(rows[0]["total_revenue"]) if rows else 0

    # 6. UTM term breakdown
    rows = _run_remote_sql(
        "SELECT \\\"utmTerm\\\", \\\"utmContent\\\", COUNT(*) AS signups "
        "FROM \\\"User\\\" "
        "WHERE \\\"utmSource\\\" = 'google' AND \\\"utmMedium\\\" = 'cpc' "
        "AND \\\"utmTerm\\\" IS NOT NULL "
        "GROUP BY \\\"utmTerm\\\", \\\"utmContent\\\" "
        "ORDER BY signups DESC LIMIT 15"
    )
    if rows:
        results["utm_terms"] = rows

    # 7. Recent payments (all sources) for revenue visibility
    rows = _run_remote_sql(
        "SELECT p.amount, p.status, p.\\\"createdAt\\\", u.email, "
        "COALESCE(u.\\\"utmSource\\\", 'organic') AS source "
        "FROM \\\"Payment\\\" p "
        "JOIN \\\"FilingYear\\\" fy ON p.\\\"filingYearId\\\" = fy.id "
        "JOIN \\\"User\\\" u ON fy.\\\"userId\\\" = u.id "
        "WHERE p.status = 'COMPLETED' "
        "ORDER BY p.\\\"createdAt\\\" DESC LIMIT 10"
    )
    if rows:
        results["recent_payments"] = rows

    if results:
        print(f"[Postgres] Fetched {len(results)} data points.")

    return results


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def _campaign_day(report_date: date) -> tuple[int, str]:
    """Return (day_number, phase_label) for the campaign."""
    delta = (report_date - CAMPAIGN_START).days + 1
    if delta < 1:
        return delta, "Pre-launch"
    if delta <= CAMPAIGN_DURATION_DAYS:
        if delta <= 3:
            phase = "Data Gathering"
        elif delta <= 7:
            phase = "Optimization"
        else:
            phase = "Scaling/Evaluation"
        return delta, phase
    return delta, "Post-campaign"


def _pct(numerator: int | float, denominator: int | float) -> str:
    if denominator == 0:
        return "N/A"
    return f"{numerator / denominator * 100:.1f}%"


def _fmt_rate(value: float) -> str:
    return f"{value * 100:.1f}%"


def _recommendations(
    campaign_day: int,
    paid_sessions: int,
    purchases: int,
    paid_revenue: float,
    ads_spend: float | None,  # None = unknown
) -> list[str]:
    """Generate automated recommendations based on thresholds."""
    recs: list[str] = []

    if campaign_day <= 3:
        recs.append(
            "**Phase: Data Gathering (Days 1–3).** Avoid making major bid or targeting "
            "changes. Let the algorithm gather enough data before optimizing."
        )

    if campaign_day <= 3 and paid_sessions == 0:
        recs.append(
            "**ALERT — 0 paid sessions recorded.** Check that ads are active, billing is "
            "configured, and GA4 UTM tracking is firing correctly."
        )
    elif paid_sessions == 0:
        recs.append(
            "**ALERT — 0 sessions from google/cpc today.** Ads may have paused, budget "
            "exhausted, or tracking broken. Investigate immediately."
        )

    if campaign_day > 3 and paid_sessions >= 50 and purchases == 0:
        recs.append(
            f"**ALERT — 0 conversions after {paid_sessions} paid sessions.** "
            "Review landing page UX, checkout flow, and conversion tracking. "
            "Consider pausing spend until root cause is identified."
        )

    if ads_spend is not None and purchases > 0:
        cpa = ads_spend / purchases
        if cpa > 100:
            recs.append(
                f"**CRITICAL — CPA ${cpa:.2f} exceeds $100.** "
                "Campaign is unprofitable at current conversion rate. "
                "Review ad targeting, match types, and negative keywords urgently."
            )
        elif cpa > BREAK_EVEN_CPA:
            recs.append(
                f"**WARNING — CPA ${cpa:.2f} above break-even (${BREAK_EVEN_CPA}).** "
                "Monitor closely. If trend continues after Day 7, tighten targeting."
            )
        else:
            roas = paid_revenue / ads_spend if ads_spend > 0 else 0
            recs.append(
                f"**CPA ${cpa:.2f} is below break-even threshold (${BREAK_EVEN_CPA}).** "
                f"ROAS: {roas:.2f}x. Campaign is profitable — consider scaling budget."
            )

    if campaign_day >= 7 and ads_spend is None:
        recs.append(
            "**Day 7+ reached.** Fill in the Google Ads Metrics section below with actual "
            "spend data to enable ROAS assessment."
        )

    if not recs:
        recs.append("No alerts triggered. Continue monitoring.")

    return recs


def build_report(report_date: date, days: int, ga4: dict, pg: dict) -> str:
    """Assemble the full Markdown report string."""
    campaign_day, phase = _campaign_day(report_date)

    # --- Aggregate totals from GA4 ---
    sessions_rows = ga4.get("sessions_by_source", [])
    total_paid_sessions = sum(r["sessions"] for r in sessions_rows)
    total_new_users_ga4 = sum(r["new_users"] for r in sessions_rows)
    avg_engagement = (
        sum(r["engagement_rate"] * r["sessions"] for r in sessions_rows) / total_paid_sessions
        if total_paid_sessions > 0
        else 0
    )

    funnel = ga4.get("funnel_events", {})
    purchases_ga4 = funnel.get("purchase", 0)
    checkouts_ga4 = funnel.get("begin_checkout", 0)

    # --- Revenue from Postgres ---
    paid_rev_data = pg.get("paid_revenue", {})
    paid_revenue = paid_rev_data.get("revenue", 0.0)
    paid_payments = paid_rev_data.get("payments", 0)

    # --- Google Ads cost data from GA4 ---
    ads_cost_rows = ga4.get("ads_cost_data", [])
    total_ads_spend = sum(r["cost"] for r in ads_cost_rows) if ads_cost_rows else None

    # --- Recommendations ---
    recs = _recommendations(campaign_day, total_paid_sessions, purchases_ga4, paid_revenue, total_ads_spend)

    lines: list[str] = []

    lines += [
        f"# FBAR Direct — Google Ads Daily Report",
        f"**Date**: {report_date.isoformat()}  |  **Period**: last {days} day(s)",
        f"**Campaign**: {CAMPAIGN_NAME}  |  **Account**: {GOOGLE_ADS_ACCOUNT}",
        "",
        "---",
        "",
    ]

    # ----------------------------------------------------------------
    # Campaign Status
    # ----------------------------------------------------------------
    lines += [
        "## Campaign Status",
        "",
        f"| | |",
        f"|---|---|",
        f"| Campaign Day | **Day {campaign_day} of {CAMPAIGN_DURATION_DAYS}** |",
        f"| Phase | {phase} |",
        f"| Campaign Window | {CAMPAIGN_START.isoformat()} → {CAMPAIGN_END.isoformat()} |",
        f"| Products | Basic ${PRICE_BASIC} / Premium ${PRICE_PREMIUM} |",
        f"| Break-even CPA | ~${BREAK_EVEN_CPA} |",
        "",
    ]

    # ----------------------------------------------------------------
    # GA4 Traffic Summary
    # ----------------------------------------------------------------
    lines += [
        "## GA4 Traffic Summary (google / cpc)",
        "",
    ]

    if not ga4:
        lines += [
            "> **GA4 data unavailable.** Set `GA4_PROPERTY_ID` env var and ensure",
            "> `../secrets/ga4-service-account.json` exists.",
            "",
        ]
    else:
        lines += [
            f"| Metric | Value |",
            f"|---|---|",
            f"| Paid Sessions | {total_paid_sessions:,} |",
            f"| New Users (GA4) | {total_new_users_ga4:,} |",
            f"| Avg Engagement Rate | {_fmt_rate(avg_engagement)} |",
            f"| Funnel — begin_checkout | {checkouts_ga4:,} |",
            f"| Funnel — purchase | {purchases_ga4:,} |",
            f"| Session → Checkout Rate | {_pct(checkouts_ga4, total_paid_sessions)} |",
            f"| Checkout → Purchase Rate | {_pct(purchases_ga4, checkouts_ga4)} |",
            "",
        ]

        # Landing pages
        lps = ga4.get("landing_pages", [])
        if lps:
            lines += [
                "### Top Landing Pages (paid traffic)",
                "",
                "| Page | Sessions | Pageviews | Bounce Rate |",
                "|---|---|---|---|",
            ]
            for lp in lps[:8]:
                lines.append(
                    f"| `{lp['page']}` | {lp['sessions']:,} | {lp['pageviews']:,} | {_fmt_rate(lp['bounce_rate'])} |"
                )
            lines.append("")

        # Device breakdown
        devices = ga4.get("devices", [])
        if devices:
            total_device_sessions = sum(d["sessions"] for d in devices)
            lines += [
                "### Device Breakdown",
                "",
                "| Device | Sessions | Share | New Users | Engagement |",
                "|---|---|---|---|---|",
            ]
            for d in devices:
                lines.append(
                    f"| {d['device'].title()} | {d['sessions']:,} | "
                    f"{_pct(d['sessions'], total_device_sessions)} | "
                    f"{d['new_users']:,} | {_fmt_rate(d['engagement_rate'])} |"
                )
            lines.append("")

        # New vs returning
        nvr = ga4.get("new_vs_returning", {})
        if nvr:
            lines += [
                "### New vs Returning (paid traffic)",
                "",
                "| Type | Sessions | Engagement |",
                "|---|---|---|",
            ]
            for label, data in nvr.items():
                lines.append(
                    f"| {label.replace('new', 'New').replace('returning', 'Returning')} "
                    f"| {data['sessions']:,} | {_fmt_rate(data['engagement_rate'])} |"
                )
            lines.append("")

    # ----------------------------------------------------------------
    # GA4 Funnel Analysis
    # ----------------------------------------------------------------
    lines += [
        "## GA4 Funnel Analysis",
        "",
    ]

    if not ga4:
        lines += ["> GA4 unavailable — see above.", ""]
    else:
        step_views = ga4.get("step_views", [])
        if step_views:
            lines += [
                "### fbar_step_view by Step (paid traffic)",
                "",
                "| Step | Views |",
                "|---|---|",
            ]
            for sv in step_views:
                lines.append(f"| {sv['step']} | {sv['views']:,} |")
            lines.append("")

        lines += [
            "### Funnel Summary",
            "",
            "| Event | Count | Drop-off from prev |",
            "|---|---|---|",
        ]
        funnel_order = ["fbar_step_view", "fbar_step_complete", "begin_checkout", "purchase"]
        prev = None
        for evt in funnel_order:
            count = funnel.get(evt, 0)
            if prev is None:
                drop = "—"
            else:
                prev_count = funnel.get(prev, 0)
                drop = _pct(count, prev_count) if prev_count > 0 else "N/A"
            lines.append(f"| `{evt}` | {count:,} | {drop} |")
            prev = evt
        lines.append("")

    # ----------------------------------------------------------------
    # Postgres: Signups & Filings
    # ----------------------------------------------------------------
    lines += [
        "## Postgres: Signups & Filings from Paid Traffic",
        "",
    ]

    if not pg:
        lines += [
            "> **Postgres data unavailable.** Check SSH key, tunnel settings, and DB credentials.",
            "",
        ]
    else:
        # Signups by day
        signups_by_day = pg.get("signups_by_day", [])
        if signups_by_day:
            lines += [
                "### Recent Signups (google/cpc)",
                "",
                "| Date | New Signups |",
                "|---|---|",
            ]
            for row in signups_by_day:
                lines.append(f"| {row['day']} | {row['count']:,} |")
            lines.append("")

        total_paid = pg.get("total_paid_signups", 0)
        lines += [
            f"**Total all-time signups from google/cpc**: {total_paid:,}",
            "",
        ]

        # UTM term breakdown
        utm_terms = pg.get("utm_terms", [])
        if utm_terms:
            lines += [
                "### Keyword → Signup Breakdown",
                "",
                "| UTM Term | Ad Content | Signups |",
                "|---|---|---|",
            ]
            for row in utm_terms:
                term = row.get("utmTerm") or "(not set)"
                content = row.get("utmContent") or "—"
                lines.append(f"| {term} | {content} | {row['signups']:,} |")
            lines.append("")

        # Filing status
        filing_status = pg.get("filing_status", [])
        if filing_status:
            lines += [
                "### Filing Status Distribution (paid users)",
                "",
                "| Status | Count |",
                "|---|---|",
            ]
            for row in filing_status:
                lines.append(f"| {row['status']} | {row['count']:,} |")
            lines.append("")

    # ----------------------------------------------------------------
    # Postgres: Revenue
    # ----------------------------------------------------------------
    lines += ["## Postgres: Revenue from Paid Traffic", ""]

    if not pg:
        lines += ["> Postgres unavailable.", ""]
    else:
        lines += [
            "| Metric | Value |",
            "|---|---|",
            f"| Completed Payments (google/cpc) | {paid_payments:,} |",
            f"| Revenue from Paid Traffic | ${paid_revenue:,.2f} |",
            f"| Avg Revenue per Payment | ${paid_revenue / paid_payments:.2f} |"
            if paid_payments > 0
            else "| Avg Revenue per Payment | N/A |",
            "",
        ]

    # ----------------------------------------------------------------
    # All-Source Revenue (so organic purchases aren't invisible)
    # ----------------------------------------------------------------
    lines += ["## All-Source Revenue (Stripe)", ""]
    if pg:
        recent_payments = pg.get("recent_payments", [])
        total_rev = pg.get("total_revenue", 0)
        total_users = pg.get("total_users", 0)
        total_filings = pg.get("total_filings", 0)
        lines += [
            f"**Total Revenue (all sources):** **${total_rev:,.2f}** from **{len(recent_payments)} payments**",
            f"**Total Users:** {total_users} | **Total Filings:** {total_filings}",
            "",
        ]
        if recent_payments:
            lines += [
                "### Recent Payments",
                "",
                "| Date | Email | Amount | Source |",
                "|---|---|---|---|",
            ]
            for p in recent_payments:
                amt = float(p.get("amount", 0))
                lines.append(
                    f"| {p.get('createdAt', '?')[:16]} | {p.get('email', '?')} | ${amt:,.2f} | {p.get('source', 'unknown')} |"
                )
            lines.append("")
    else:
        lines += ["> Postgres unavailable.", ""]

    # ----------------------------------------------------------------
    # Google Ads Metrics (from GA4 cost data import)
    # ----------------------------------------------------------------
    if ads_cost_rows:
        total_impr = sum(r["impressions"] for r in ads_cost_rows)
        total_clicks = sum(r["clicks"] for r in ads_cost_rows)
        total_cost = sum(r["cost"] for r in ads_cost_rows)
        avg_cpc = total_cost / total_clicks if total_clicks > 0 else 0
        ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0

        lines += [
            "## Google Ads Metrics *(from GA4 cost data import)*",
            "",
            "| Metric | Value | Target | Notes |",
            "|---|---|---|---|",
            f"| **Impressions** | **{total_impr:,}** | 500+/day | {'On target' if total_impr >= 500 else 'Low volume'} |",
            f"| **Clicks** | **{total_clicks:,}** | 15-35/day | {'On target' if 15 <= total_clicks <= 35 else 'Low' if total_clicks < 15 else 'High volume'} |",
            f"| **CTR** | **{ctr:.2f}%** | 3-8% | {'Healthy' if 3 <= ctr <= 8 else 'Low — review ad copy' if ctr < 3 else 'Excellent'} |",
            f"| **Avg CPC** | **${avg_cpc:.2f}** | $3-8 | {'Excellent — cheap clicks' if avg_cpc < 3 else 'On target' if avg_cpc <= 8 else 'High'} |",
            f"| **Spend** | **${total_cost:.2f}** | $100/day | {total_cost / 100 * 100:.0f}% of budget |",
            f"| **Conversions** | **{purchases_ga4}** | — | {'None yet' if purchases_ga4 == 0 else f'{purchases_ga4} purchases'} |",
        ]
        if purchases_ga4 > 0 and total_cost > 0:
            cpa_val = total_cost / purchases_ga4
            roas_val = paid_revenue / total_cost if total_cost > 0 else 0
            lines.append(f"| **CPA** | **${cpa_val:.2f}** | < $30 | {'Profitable' if cpa_val < BREAK_EVEN_CPA else 'Above break-even'} |")
            lines.append(f"| **ROAS** | **{roas_val:.2f}:1** | > 1.0 | {'Profitable' if roas_val > 1 else 'Unprofitable'} |")
        else:
            lines.append("| **CPA** | N/A | < $30 | No conversions yet |")
            lines.append("| **ROAS** | 0:1 | > 1.0 | No ad-attributed revenue |")
        lines.append("")

        # Ad group breakdown
        lines += [
            "### Ad Group Breakdown",
            "",
            "| Ad Group | Impressions | Clicks | CTR | CPC | Spend |",
            "|---|---|---|---|---|---|",
        ]
        for row in sorted(ads_cost_rows, key=lambda r: r["cost"], reverse=True):
            ag_ctr = (row["clicks"] / row["impressions"] * 100) if row["impressions"] > 0 else 0
            ag_cpc = f"${row['cpc']:.2f}" if row["clicks"] > 0 else "—"
            lines.append(
                f"| {row['ad_group']} | {row['impressions']:,} | {row['clicks']:,} | {ag_ctr:.2f}% | {ag_cpc} | ${row['cost']:.2f} |"
            )
        lines.append("")
    else:
        lines += [
            "## Google Ads Metrics *(awaiting GA4 ↔ Google Ads data link)*",
            "",
            "> Google Ads cost data is not yet available in GA4.",
            "> The GA4 ↔ Google Ads link was created 2026-04-01. Data should appear within 24-48h.",
            "> Until then, check ads.google.com manually.",
            "",
        ]

    # ----------------------------------------------------------------
    # Automated Recommendations
    # ----------------------------------------------------------------
    lines += [
        "## Automated Recommendations",
        "",
        f"*Generated for Day {campaign_day} of {CAMPAIGN_DURATION_DAYS} — Phase: {phase}*",
        "",
    ]
    for i, rec in enumerate(recs, 1):
        lines.append(f"{i}. {rec}")
    lines.append("")

    # ----------------------------------------------------------------
    # Cumulative Totals (all-time platform)
    # ----------------------------------------------------------------
    lines += [
        "## Cumulative Platform Totals (all traffic, all time)",
        "",
    ]
    if not pg:
        lines += ["> Postgres unavailable.", ""]
    else:
        lines += [
            "| Metric | Value |",
            "|---|---|",
            f"| Total Users | {pg.get('total_users', 0):,} |",
            f"| Total FilingYears | {pg.get('total_filings', 0):,} |",
            f"| Total Revenue | ${pg.get('total_revenue', 0):,.2f} |",
            "",
        ]

    lines += [
        "---",
        f"*Report generated: {datetime.now(tz=MT).strftime('%Y-%m-%d %H:%M:%S MT')}*",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate FBAR Direct Google Ads daily performance report."
    )
    parser.add_argument(
        "--date",
        help="Report date in YYYY-MM-DD format (default: yesterday)",
        type=lambda s: datetime.strptime(s, "%Y-%m-%d").date(),
        default=None,
    )
    parser.add_argument(
        "--days",
        help="Number of days to include in the report window (default: 1)",
        type=int,
        default=1,
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    report_date = args.date if args.date else datetime.now(tz=MT).date() - timedelta(days=1)
    days = max(1, args.days)

    print(f"Generating report for {report_date} (window: {days} day(s))...")

    # Fetch data (failures are handled gracefully inside each function)
    print("\n--- GA4 ---")
    ga4 = {}
    try:
        ga4 = fetch_ga4_data(report_date, days)
    except Exception as exc:
        print(f"[GA4] Unexpected error: {exc}")

    print("\n--- Postgres ---")
    pg = {}
    try:
        pg = fetch_postgres_data(report_date)
    except Exception as exc:
        print(f"[Postgres] Unexpected error: {exc}")

    print("\n--- Building report ---")
    report_md = build_report(report_date, days, ga4, pg)

    # Write report
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = REPORTS_DIR / f"{report_date.isoformat()}.md"
    output_path.write_text(report_md, encoding="utf-8")

    print(f"\nReport written to:\n  {output_path}")


if __name__ == "__main__":
    main()
