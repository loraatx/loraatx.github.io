#!/usr/bin/env python3
"""
build-coffee-shops.py

Builds apps/coffee-shops/data.geojson by:
  1. Querying Overpass API for amenity=cafe in Austin
  2. Fetching Austin health inspection records (last 2 years) from data.austintexas.gov
  3. Cross-referencing by fuzzy name/address match
  4. Classifying each shop as Independent or Corporate
  5. Filtering out places with stale (>24 month) or missing inspection activity

Output properties per feature:
  name, type (Independent|Corporate), address, phone, lat, lng,
  inspection_score, inspection_date
"""

import json
import math
import re
import sys
import time
import unicodedata
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import URLError

REPO_ROOT = "/home/user/loraatx.github.io"
OUT_PATH = f"{REPO_ROOT}/apps/coffee-shops/data.geojson"

# Austin bounding box (generous to cover all metro)
AUSTIN_BBOX = "29.90,-97.98,30.57,-97.37"

# Socrata app token — raises rate limit to 1,000 req/hour
SOCRATA_TOKEN = "FjcovQYJRF7BTzvbHS2zbG3e1"
SOCRATA_BASE = "https://data.austintexas.gov/resource/ecmv-9xxi.json"
SOCRATA_PAGE_SIZE = 50000

# National/regional coffee chains — anything matching these names = Corporate
CORPORATE_NAMES = {
    "starbucks", "dunkin", "dunkin donuts", "dunkin'", "dutch bros", "dutch brothers",
    "peet's coffee", "peets coffee", "caribou coffee", "the coffee bean",
    "coffee bean & tea leaf", "tim hortons", "mcdonald's", "mcdonalds",
    "panera bread", "panera", "einstein bros", "einstein bagels",
    "corner bakery", "biggby coffee", "biggby", "scooter's coffee", "scooters coffee",
    "7-eleven", "seven eleven", "circle k", "mccafe",
}

# Max age of last inspection to consider a place "still open"
MAX_INSPECTION_AGE_DAYS = 730  # 2 years


def fetch_url(url, headers=None, retries=3):
    for attempt in range(retries):
        try:
            req = Request(url, headers=headers or {"User-Agent": "anatomy-city-builder/1.0"})
            with urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  Retry {attempt+1} after {wait}s ({e})")
                time.sleep(wait)
            else:
                raise


def fetch_osm_cafes():
    print("Fetching Austin cafes from Overpass API...")
    # Query nodes, ways, and relations tagged amenity=cafe or shop=coffee
    query = f"""
[out:json][timeout:60];
(
  node["amenity"="cafe"]({AUSTIN_BBOX});
  node["shop"="coffee"]({AUSTIN_BBOX});
);
out body;
"""
    url = "https://overpass-api.de/api/interpreter"
    req = Request(
        url,
        data=query.encode("utf-8"),
        headers={"User-Agent": "anatomy-city-builder/1.0", "Content-Type": "application/x-www-form-urlencoded"},
    )
    raw = None
    for attempt in range(4):
        try:
            with urlopen(req, timeout=90) as r:
                raw = r.read().decode("utf-8")
            break
        except Exception as e:
            if attempt < 3:
                wait = 2 ** attempt
                print(f"  Retry {attempt+1} after {wait}s ({e})")
                time.sleep(wait)
            else:
                raise

    data = json.loads(raw)
    elements = data.get("elements", [])
    print(f"  Got {len(elements)} OSM elements")
    return elements


def fetch_health_inspections():
    """Paginate through the Austin health inspection dataset using the app token."""
    print("Fetching Austin health inspection records (paginated)...")
    cutoff = (datetime.now() - timedelta(days=MAX_INSPECTION_AGE_DAYS)).strftime("%Y-%m-%dT00:00:00.000")
    headers = {
        "User-Agent": "anatomy-city-builder/1.0",
        "X-App-Token": SOCRATA_TOKEN,
    }
    all_records = []
    offset = 0
    while True:
        params = {
            "$limit": SOCRATA_PAGE_SIZE,
            "$offset": offset,
            "$where": f"inspection_date >= '{cutoff}'",
            "$order": "inspection_date DESC, facility_id ASC",
            "$select": "facility_id,restaurant_name,address,score,inspection_date,process_description,zip_code",
        }
        url = SOCRATA_BASE + "?" + urlencode(params)
        for attempt in range(4):
            try:
                req = Request(url, headers=headers)
                with urlopen(req, timeout=60) as r:
                    page = json.loads(r.read().decode("utf-8"))
                break
            except Exception as e:
                if attempt < 3:
                    wait = 2 ** attempt
                    print(f"  Retry {attempt+1} after {wait}s ({e})")
                    time.sleep(wait)
                else:
                    raise
        if not page:
            break
        all_records.extend(page)
        print(f"  Fetched {len(all_records)} records so far (page offset={offset})")
        if len(page) < SOCRATA_PAGE_SIZE:
            break  # last page
        offset += SOCRATA_PAGE_SIZE
    print(f"  Total inspection records: {len(all_records)}")
    return all_records


def normalize(s):
    """Lowercase, strip punctuation/accents, collapse whitespace."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


def classify_type(name, tags):
    """Return 'Corporate' if it's a known chain, else 'Independent'."""
    brand = normalize(tags.get("brand") or tags.get("operator") or "")
    name_n = normalize(name)
    for check in [name_n, brand]:
        if not check:
            continue
        for chain in CORPORATE_NAMES:
            if chain in check:
                return "Corporate"
    return "Independent"


def build_address(tags):
    parts = []
    num = tags.get("addr:housenumber", "").strip()
    street = tags.get("addr:street", "").strip()
    city = tags.get("addr:city", "").strip()
    state = tags.get("addr:state", "").strip()
    if num and street:
        parts.append(f"{num} {street}")
    elif street:
        parts.append(street)
    if city:
        parts.append(city)
    elif parts:
        parts.append("Austin")
    if state:
        parts.append(state)
    return ", ".join(parts) if parts else ""


def index_health_records(records):
    """Build a dict keyed by normalized name for fast lookup."""
    index = {}
    for rec in records:
        key = normalize(rec.get("restaurant_name", ""))
        if key not in index:
            index[key] = []
        index[key].append(rec)
    return index


def match_health_record(osm_name, osm_addr, health_index):
    """
    Try to find the best matching health inspection record.
    Returns (best_record, score) or (None, 0).
    """
    n_name = normalize(osm_name)
    n_addr = normalize(osm_addr)

    best_rec = None
    best_score = 0.0

    for h_name, recs in health_index.items():
        name_sim = similarity(n_name, h_name)

        # Exact word overlap boost
        osm_words = set(n_name.split())
        h_words = set(h_name.split())
        overlap = osm_words & h_words
        if overlap and len(overlap) >= max(1, len(osm_words) - 1):
            name_sim = max(name_sim, 0.85)

        if name_sim < 0.55:
            continue

        for rec in recs:
            h_addr = normalize(rec.get("address", ""))
            addr_sim = 0.0
            if n_addr and h_addr:
                addr_sim = similarity(n_addr, h_addr)
                # Boost if street number matches
                osm_num = re.match(r"^\d+", n_addr)
                h_num = re.match(r"^\d+", h_addr)
                if osm_num and h_num and osm_num.group() == h_num.group():
                    addr_sim = max(addr_sim, 0.8)

            combined = name_sim * 0.7 + addr_sim * 0.3 if addr_sim else name_sim
            if combined > best_score:
                best_score = combined
                best_rec = rec

    return best_rec, best_score


def best_inspection_score(facility_id, records):
    """Get the most recent inspection record for this facility_id."""
    matching = [r for r in records if r.get("facility_id") == facility_id]
    if not matching:
        return None
    # Sort by date descending
    def parse_date(r):
        try:
            return datetime.fromisoformat(r["inspection_date"][:10])
        except Exception:
            return datetime.min
    matching.sort(key=parse_date, reverse=True)
    return matching[0]


def main():
    # Fetch data
    osm_elements = fetch_osm_cafes()
    health_records = fetch_health_inspections()
    health_index = index_health_records(health_records)

    cutoff_date = datetime.now() - timedelta(days=MAX_INSPECTION_AGE_DAYS)

    features = []
    skipped_no_name = 0
    skipped_stale = 0
    matched = 0
    unmatched = 0

    for el in osm_elements:
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name:
            skipped_no_name += 1
            continue

        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            continue

        address = build_address(tags)
        phone = tags.get("phone") or tags.get("contact:phone") or ""
        # Normalize phone to (XXX) XXX-XXXX if possible
        digits = re.sub(r"\D", "", phone)
        if len(digits) == 10:
            phone = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            phone = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

        # Website
        website = (tags.get("website") or tags.get("contact:website") or "").strip()
        if website and not website.startswith("http"):
            website = "https://" + website

        # Wi-Fi (OSM internet_access tag)
        ia = tags.get("internet_access", "")
        wifi = "Yes" if ia in ("wlan", "yes", "wifi") else ("No" if ia == "no" else None)

        # Outdoor seating
        os_raw = tags.get("outdoor_seating", "")
        outdoor_seating = "Yes" if os_raw == "yes" else ("No" if os_raw == "no" else None)

        # Drive-through
        dt_raw = tags.get("drive_through", "")
        drive_through = "Yes" if dt_raw == "yes" else ("No" if dt_raw == "no" else None)

        # Try health record match
        best_rec, match_score = match_health_record(name, address, health_index)

        inspection_score = None
        inspection_date = None

        if best_rec and match_score >= 0.60:
            matched += 1
            # Check if the matched facility has a recent inspection
            facility_id = best_rec.get("facility_id")
            latest = best_inspection_score(facility_id, health_records) if facility_id else best_rec
            if latest:
                try:
                    last_dt = datetime.fromisoformat(latest["inspection_date"][:10])
                    if last_dt < cutoff_date:
                        skipped_stale += 1
                        continue  # Last inspection too old — likely closed
                    inspection_date = latest["inspection_date"][:10]
                    raw_score = latest.get("score")
                    if raw_score is not None:
                        try:
                            inspection_score = int(float(str(raw_score)))
                        except (ValueError, TypeError):
                            pass
                except Exception:
                    pass
        else:
            unmatched += 1
            # Not in health records — could still be open, include without score

        biz_type = classify_type(name, tags)

        props = {
            "name": name,
            "type": biz_type,
            "address": address or None,
            "phone": phone or None,
            "website": website or None,
            "wifi": wifi,
            "outdoor_seating": outdoor_seating,
            "drive_through": drive_through,
            "lat": round(lat, 6),
            "lng": round(lon, 6),
        }
        if inspection_score is not None:
            props["inspection_score"] = inspection_score
        if inspection_date:
            props["inspection_date"] = inspection_date

        # Strip None values to keep GeoJSON clean
        props = {k: v for k, v in props.items() if v is not None}

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": props,
        })

    geojson = {"type": "FeatureCollection", "features": features}

    with open(OUT_PATH, "w") as f:
        json.dump(geojson, f, indent=2)

    print()
    print(f"Results:")
    print(f"  Total OSM cafes:        {len(osm_elements)}")
    print(f"  Skipped (no name):      {skipped_no_name}")
    print(f"  Skipped (stale/closed): {skipped_stale}")
    print(f"  Matched health records: {matched}")
    print(f"  Unmatched (included):   {unmatched}")
    print(f"  FEATURES IN OUTPUT:     {len(features)}")
    print(f"  Written to:             {OUT_PATH}")


if __name__ == "__main__":
    main()
