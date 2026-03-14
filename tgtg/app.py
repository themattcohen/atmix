"""TGTG Pickup Optimizer — Streamlit UI."""

import re
from datetime import date, timedelta
from itertools import groupby
from typing import Any
from zoneinfo import ZoneInfo

import folium
import streamlit as st
from geopy.geocoders import Nominatim
from streamlit_folium import st_folium

from auth import TgtgClient, get_client, save_credentials
from clustering import (
    _bag_area,
    _bag_coords,
    _pickup_window,
    cluster_bags,
    distance_miles,
)

Bag = dict[str, Any]
Run = dict[str, Any]

CATEGORY_MAP = {
    "BAKED_GOODS": "Bakery",
    "BREAD": "Bread",
    "PASTRIES_AND_CAKES": "Pastry",
    "MEALS": "Meal",
    "OTHER": "Surprise",
    "GROCERIES": "Grocery",
    "PETFOOD": "Pet Food",
}

US_TIMEZONES = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
]

RUN_COLORS = ["red", "blue", "green", "orange", "purple", "darkred", "cadetblue", "darkgreen"]

KM_PER_MILE = 1.609


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_time(dt, tz: ZoneInfo) -> str:
    local = dt.astimezone(tz)
    hour = local.hour % 12 or 12
    return f"{hour}:{local.strftime('%M%p').lower()}"


def _fmt_day(dt, tz: ZoneInfo) -> str:
    local = dt.astimezone(tz).date()
    today = date.today()
    if local == today:
        return "Today"
    if local == today + timedelta(days=1):
        return "Tomorrow"
    return local.strftime("%a %b %d")


def _price(bag: Bag) -> str:
    p = bag.get("item", {}).get("item_price", {})
    if not p:
        return "?"
    return f"${p.get('minor_units', 0) / 100:.2f}"


def _bag_type(bag: Bag) -> str:
    display = bag.get("display_name", "")
    m = re.search(r"\(([^)]+)\)$", display)
    if m:
        return m.group(1)
    cat = bag.get("item", {}).get("item_category", "")
    return CATEGORY_MAP.get(cat, cat.replace("_", " ").title() if cat else "Surprise")


def _short_address(bag: Bag) -> str:
    addr = bag["store"]["store_location"].get("address", {})
    line = addr.get("address_line", "")
    parts = [p.strip() for p in line.split(",")]
    return parts[0] if parts else ""


def _unique_stores(bags: list[Bag]) -> list[Bag]:
    """Deduplicate bags by store coordinates, return one bag per unique location."""
    seen = {}
    unique = []
    for b in bags:
        lat, lng = _bag_coords(b)
        key = (round(lat, 4), round(lng, 4))
        if key not in seen:
            seen[key] = True
            unique.append(b)
    return unique


def _max_distance_miles_in_run(run: Run) -> float:
    """Max pairwise distance in miles between unique store locations."""
    unique = _unique_stores(run["bags"])
    if len(unique) < 2:
        return 0.0
    max_mi = 0.0
    for i, a in enumerate(unique):
        for b in unique[i + 1:]:
            la, lna = _bag_coords(a)
            lb, lnb = _bag_coords(b)
            d = distance_miles(la, lna, lb, lnb)
            if d > max_mi:
                max_mi = d
    return max_mi


def _estimate_drive_minutes(run: Run) -> int:
    mi = _max_distance_miles_in_run(run)
    # ~2.5 min per mile in suburban areas
    return max(1, round(mi * 2.5)) if mi > 0 else 0


def _geocode_input(address_input: str) -> tuple[float, float] | None:
    """Parse 'lat,lng' or geocode an address string."""
    # Try parsing as lat,lng
    parts = [p.strip() for p in address_input.split(",")]
    if len(parts) == 2:
        try:
            lat, lng = float(parts[0]), float(parts[1])
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng
        except ValueError:
            pass
    # Geocode via Nominatim
    try:
        geo = Nominatim(user_agent="tgtg-optimizer")
        loc = geo.geocode(address_input)
        if loc:
            return loc.latitude, loc.longitude
    except Exception:
        pass
    return None


# ── Streamlit App ──────────────────────────────────────────────────────────────

st.set_page_config(page_title="TGTG Pickup Optimizer", page_icon="\U0001f961", layout="wide")
st.title("\U0001f961 TGTG Pickup Optimizer")

# ── Sidebar ────────────────────────────────────────────────────────────────────

with st.sidebar:
    st.header("Settings")

    email = st.text_input("TGTG Email", value="", placeholder="you@example.com")
    address = st.text_input(
        "Address or Coordinates",
        value="",
        placeholder="123 Main St, Denver CO  or  39.59,-105.01",
    )
    radius_miles = st.slider("Search radius (miles)", 5, 50, 30)
    max_dist_miles = st.slider("Max distance between stops (miles)", 1, 15, 5)
    min_overlap = st.slider("Min pickup window overlap (min)", 5, 60, 15)
    tz_name = st.selectbox("Timezone", US_TIMEZONES, index=US_TIMEZONES.index("America/Denver"))

    fetch_btn = st.button("\U0001f50d Fetch Bags", type="primary", use_container_width=True)

tz = ZoneInfo(tz_name)

# ── Auth State ─────────────────────────────────────────────────────────────────

if "auth_phase" not in st.session_state:
    st.session_state.auth_phase = "idle"  # idle | polling | ready
if "client" not in st.session_state:
    st.session_state.client = None
if "items" not in st.session_state:
    st.session_state.items = None

# ── Auth Flow ──────────────────────────────────────────────────────────────────

if fetch_btn:
    if not email:
        st.error("Please enter your TGTG email.")
        st.stop()
    coords = _geocode_input(address) if address else None
    if not coords:
        st.error("Could not resolve address. Try 'lat,lng' format (e.g. 39.59,-105.01).")
        st.stop()

    st.session_state.coords = coords
    st.session_state.email = email

    with st.spinner("Connecting to TGTG..."):
        client = get_client(email)

        if client.access_token and client.refresh_token:
            # Have cached tokens — try refresh
            try:
                client.login()
                st.session_state.client = client
                st.session_state.auth_phase = "ready"
            except Exception:
                st.session_state.auth_phase = "need_email_login"
                st.session_state.client = client
        else:
            st.session_state.auth_phase = "need_email_login"
            st.session_state.client = client

    if st.session_state.auth_phase == "need_email_login":
        # Trigger email login
        try:
            client = st.session_state.client
            response = client._post("auth/v5/authByEmail", {
                "device_type": "ANDROID",
                "email": email,
            })
            if response.status_code != 200:
                st.error(f"Login failed: {response.status_code}")
                st.stop()
            data = response.json()
            if data.get("state") == "TERMS":
                st.error(f"Email {email} is not linked to a TGTG account.")
                st.stop()
            if data.get("state") != "WAIT":
                st.error(f"Unexpected login state: {data.get('state')}")
                st.stop()
            st.session_state.polling_id = data["polling_id"]
            st.session_state.auth_phase = "polling"
        except Exception as e:
            st.error(f"Login error: {e}")
            st.stop()

# ── Polling UI ─────────────────────────────────────────────────────────────────

if st.session_state.auth_phase == "polling":
    st.info("Check your email and click the TGTG login link (on a computer, not your phone).")
    col1, col2 = st.columns([3, 1])
    with col1:
        st.write("After clicking the link, press the button below:")
    with col2:
        if st.button("I clicked the link"):
            client = st.session_state.client
            polling_id = st.session_state.polling_id
            response = client._post("auth/v5/authByRequestPollingId", {
                "device_type": "ANDROID",
                "email": st.session_state.email,
                "request_polling_id": polling_id,
            })
            if response.status_code == 200:
                data = response.json()
                client.access_token = data["access_token"]
                client.refresh_token = data["refresh_token"]
                set_cookie = response.headers.get("Set-Cookie", "")
                dd_match = re.search(r"datadome=([^;]+)", set_cookie)
                if dd_match:
                    client.datadome_cookie = dd_match.group(1)
                st.session_state.client = client
                st.session_state.auth_phase = "ready"
                save_credentials(client, st.session_state.email)
                st.rerun()
            elif response.status_code == 202:
                st.warning("Not confirmed yet. Click the email link first, then try again.")
            else:
                st.error(f"Auth failed: {response.status_code}")

# ── Fetch Items ────────────────────────────────────────────────────────────────

if st.session_state.auth_phase == "ready" and st.session_state.get("coords"):
    client = st.session_state.client
    coords = st.session_state.coords
    radius_km = int(radius_miles * KM_PER_MILE)

    with st.spinner("Fetching available bags..."):
        try:
            items = client.get_items(
                latitude=coords[0],
                longitude=coords[1],
                radius=radius_km,
                with_stock_only=True,
            )
            save_credentials(client, st.session_state.get("email", ""))
            st.session_state.items = items
            st.session_state.auth_phase = "done"
            st.rerun()
        except Exception as e:
            st.error(f"Failed to fetch bags: {e}")

# ── Display Results ────────────────────────────────────────────────────────────

if st.session_state.items is not None:
    items = st.session_state.items
    coords = st.session_state.get("coords", (39.59, -105.01))

    if not items:
        st.warning("No bags available right now. Try again later!")
        st.stop()

    runs, singles = cluster_bags(
        items,
        max_distance_miles=max_dist_miles,
        min_overlap_min=min_overlap,
    )
    total = sum(1 for b in items if isinstance(b, dict) and b.get("items_available", 0) > 0)

    st.caption(f"Found **{total}** available bags \u2192 **{len(runs)}** runs, **{len(singles)}** singles")

    # ── Split by day ──
    def _run_day_key(run: Run) -> str:
        return _fmt_day(run["effective_start"], tz)

    def _bag_day_key(bag: Bag) -> str:
        s, _ = _pickup_window(bag)
        return _fmt_day(s, tz)

    # Collect day labels
    day_labels = []
    for r in runs:
        d = _run_day_key(r)
        if d not in day_labels:
            day_labels.append(d)
    for s in singles:
        d = _bag_day_key(s)
        if d not in day_labels:
            day_labels.append(d)

    if not day_labels:
        day_labels = ["Today"]

    tabs = st.tabs(day_labels)

    for tab, day_label in zip(tabs, day_labels):
        with tab:
            day_runs = [r for r in runs if _run_day_key(r) == day_label]
            day_singles = [s for s in singles if _bag_day_key(s) == day_label]

            # ── Map ──
            all_day_bags = []
            for r in day_runs:
                all_day_bags.extend(r["bags"])
            all_day_bags.extend(day_singles)

            if all_day_bags:
                m = folium.Map(location=[coords[0], coords[1]], zoom_start=11)

                # Runs — colored pins
                for ri, run in enumerate(day_runs):
                    color = RUN_COLORS[ri % len(RUN_COLORS)]
                    for bag in run["bags"]:
                        lat, lng = _bag_coords(bag)
                        name = bag["store"].get("store_name", "Unknown")
                        price = _price(bag)
                        folium.Marker(
                            [lat, lng],
                            popup=f"<b>{name}</b><br>{price}<br>Run {ri + 1}",
                            icon=folium.Icon(color=color, icon="shopping-bag", prefix="fa"),
                        ).add_to(m)

                # Singles — gray pins
                for bag in day_singles:
                    lat, lng = _bag_coords(bag)
                    name = bag["store"].get("store_name", "Unknown")
                    price = _price(bag)
                    folium.Marker(
                        [lat, lng],
                        popup=f"<b>{name}</b><br>{price}<br>Single",
                        icon=folium.Icon(color="gray", icon="shopping-bag", prefix="fa"),
                    ).add_to(m)

                st_folium(m, width=700, height=400, use_container_width=True)

            # ── Run Cards ──
            for ri, run in enumerate(day_runs):
                area = run.get("area", "Unknown")
                n_bags = len(run["bags"])
                unique = _unique_stores(run["bags"])
                n_stops = len(unique)
                eff_start = _fmt_time(run["effective_start"], tz)
                eff_end = _fmt_time(run["effective_end"], tz)
                drive = _estimate_drive_minutes(run)
                max_mi = _max_distance_miles_in_run(run)

                label = (
                    f"\U0001f697 RUN {ri + 1} \u2014 {area} "
                    f"({n_stops} stop{'s' if n_stops != 1 else ''}, "
                    f"{n_bags} bag{'s' if n_bags != 1 else ''}, "
                    f"pickup {eff_start}\u2013{eff_end})"
                )

                with st.expander(label, expanded=True):
                    rows = []
                    for bag in run["bags"]:
                        store = bag["store"]
                        s, e = _pickup_window(bag)
                        rows.append({
                            "Store": store.get("store_name", "Unknown"),
                            "Address": _short_address(bag),
                            "Type": _bag_type(bag),
                            "Price": _price(bag),
                            "Window": f"{_fmt_time(s, tz)}\u2013{_fmt_time(e, tz)}",
                            "Avail": bag.get("items_available", 0),
                        })
                    st.dataframe(rows, use_container_width=True, hide_index=True)
                    if drive > 0:
                        st.caption(f"\U0001f4cd ~{max_mi:.1f} mi / ~{drive} min between stops")

            # ── Singles ──
            if day_singles:
                st.markdown("---")
                st.subheader("Singles")
                rows = []
                for bag in day_singles:
                    s, e = _pickup_window(bag)
                    rows.append({
                        "Store": bag["store"].get("store_name", "Unknown"),
                        "Address": _short_address(bag),
                        "Type": _bag_type(bag),
                        "Price": _price(bag),
                        "Window": f"{_fmt_time(s, tz)}\u2013{_fmt_time(e, tz)}",
                        "Area": _bag_area(bag),
                        "Avail": bag.get("items_available", 0),
                    })
                st.dataframe(rows, use_container_width=True, hide_index=True)

elif st.session_state.auth_phase == "idle":
    st.info("Enter your TGTG email and location in the sidebar, then click **Fetch Bags**.")
