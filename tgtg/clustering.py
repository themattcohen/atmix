"""Geo + time-overlap clustering for TGTG bags."""

from datetime import datetime, timezone
from typing import Any

from geopy.distance import geodesic

# A "run" is a dict with keys: bags, effective_start, effective_end, area
Run = dict[str, Any]
Bag = dict[str, Any]

KM_PER_MILE = 1.609


def _parse_time(iso: str) -> datetime:
    """Parse ISO-8601 string to timezone-aware datetime."""
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _pickup_window(bag: Bag) -> tuple[datetime, datetime]:
    """Extract pickup start/end from a bag dict."""
    start = _parse_time(bag["pickup_interval"]["start"])
    end = _parse_time(bag["pickup_interval"]["end"])
    return start, end


def _overlap_minutes(start_a: datetime, end_a: datetime,
                     start_b: datetime, end_b: datetime) -> float:
    """Minutes of overlap between two time intervals."""
    latest_start = max(start_a, start_b)
    earliest_end = min(end_a, end_b)
    delta = (earliest_end - latest_start).total_seconds() / 60
    return max(0, delta)


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Geodesic distance in km."""
    return geodesic((lat1, lng1), (lat2, lng2)).km


def distance_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Geodesic distance in miles."""
    return geodesic((lat1, lng1), (lat2, lng2)).miles


def _bag_coords(bag: Bag) -> tuple[float, float]:
    loc = bag["store"]["store_location"]
    return loc["location"]["latitude"], loc["location"]["longitude"]


def _bag_area(bag: Bag) -> str:
    """Best-effort area name from address."""
    addr = bag["store"]["store_location"].get("address", {})
    city = addr.get("city", "")
    if not city:
        line = addr.get("address_line", "")
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2:
            city = parts[-3] if len(parts) >= 3 else parts[0]
    return city or "Unknown"


def _is_near_run(bag: Bag, run: Run, max_distance_km: float) -> bool:
    """Check if bag is within max_distance_km of any bag in the run."""
    lat, lng = _bag_coords(bag)
    for rb in run["bags"]:
        rlat, rlng = _bag_coords(rb)
        if _distance_km(lat, lng, rlat, rlng) <= max_distance_km:
            return True
    return False


def _overlaps_run(bag: Bag, run: Run, min_overlap_min: float) -> bool:
    """Check if bag's pickup window overlaps the run's effective window."""
    bag_start, bag_end = _pickup_window(bag)
    return _overlap_minutes(bag_start, bag_end,
                            run["effective_start"], run["effective_end"]) >= min_overlap_min


def cluster_bags(bags: list[Bag], *,
                 max_distance_miles: float = 5.0,
                 min_overlap_min: float = 15.0) -> tuple[list[Run], list[Bag]]:
    """
    Cluster bags into multi-stop runs.

    Returns (runs, singles) where runs have >= 2 bags.
    """
    max_distance_km = max_distance_miles * KM_PER_MILE

    # Filter to in-stock, sort by pickup start
    available = [b for b in bags if b.get("items_available", 0) > 0]
    available.sort(key=lambda b: _pickup_window(b)[0])

    runs: list[Run] = []

    for bag in available:
        bag_start, bag_end = _pickup_window(bag)
        placed = False

        for run in runs:
            if _is_near_run(bag, run, max_distance_km) and _overlaps_run(bag, run, min_overlap_min):
                run["bags"].append(bag)
                # Tighten effective window
                run["effective_start"] = max(run["effective_start"], bag_start)
                run["effective_end"] = min(run["effective_end"], bag_end)
                placed = True
                break

        if not placed:
            runs.append({
                "bags": [bag],
                "effective_start": bag_start,
                "effective_end": bag_end,
            })

    # Split into real runs (>= 2) and singles
    multi = [r for r in runs if len(r["bags"]) >= 2]
    singles = []
    for r in runs:
        if len(r["bags"]) < 2:
            singles.extend(r["bags"])

    # Add area name to each run from most common city
    for run in multi:
        cities = [_bag_area(b) for b in run["bags"]]
        run["area"] = max(set(cities), key=cities.count)

    return multi, singles
