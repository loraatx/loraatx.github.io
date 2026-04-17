#!/usr/bin/env python3
"""
staging_intake.py — Deterministic helpers for the assets/staging/ → site pipeline.

This script does the boring/mechanical bits so Claude (the orchestrator) can
focus on the editorial choices (field picking, scene authoring, etc.). See
`apps/skills/staging-intake/SKILL.md` for the full pipeline doc.

Subcommands:
    triage          — list staging contents, parse note.md, print a JSON plan.
    csv-to-geojson  — convert a CSV with latitude/longitude columns into GeoJSON.
                      Skips rows missing coords; reports the skipped names.

Usage:
    python scripts/staging_intake.py triage
    python scripts/staging_intake.py csv-to-geojson \\
        --csv "assets/staging/cd19bead (1).csv" \\
        --out apps/citywide/austin-chambers/data.geojson
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STAGING = REPO_ROOT / "assets" / "staging"


# ─── note.md front-matter parser (minimal YAML, no PyYAML dependency) ────────

def parse_front_matter(text: str) -> tuple[dict, str]:
    """Parse a leading `---\\n...\\n---\\n` block. Returns (data, body)."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", text, re.DOTALL)
    if not m:
        return {}, text
    raw, body = m.group(1), m.group(2)
    data: dict = {}
    current_key: str | None = None
    for line in raw.split("\n"):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        # Nested mapping (one level deep, e.g. report.cover_image)
        if line.startswith("  ") and current_key and isinstance(data.get(current_key), dict):
            sub = line.strip()
            if ":" in sub:
                k, v = sub.split(":", 1)
                data[current_key][k.strip()] = _coerce(v.strip())
            continue
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip(), v.strip()
        if not v:
            data[k] = {}
            current_key = k
            continue
        data[k] = _coerce(v)
        current_key = k
    return data, body


def _coerce(v: str):
    v = v.strip()
    # strip trailing inline comments
    v = re.sub(r"\s+#.*$", "", v).strip()
    if v.startswith('"') and v.endswith('"'):
        return v[1:-1]
    if v.startswith("'") and v.endswith("'"):
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        if not inner:
            return []
        return [_coerce(x.strip()) for x in inner.split(",")]
    if v.lower() in ("true", "yes"):
        return True
    if v.lower() in ("false", "no"):
        return False
    if re.match(r"^-?\d+$", v):
        return int(v)
    if re.match(r"^-?\d*\.\d+$", v):
        return float(v)
    return v


# ─── Triage ──────────────────────────────────────────────────────────────────

def triage() -> dict:
    if not STAGING.exists():
        return {"error": f"{STAGING} does not exist"}

    files = sorted([p for p in STAGING.iterdir() if p.is_file()])
    by_ext: dict[str, list[Path]] = {}
    for f in files:
        by_ext.setdefault(f.suffix.lower(), []).append(f)

    note_path = STAGING / "note.md"
    front: dict = {}
    if note_path.exists():
        front, _body = parse_front_matter(note_path.read_text(encoding="utf-8"))

    # Pick the report MD (largest .md that isn't note.md or staging plan.md)
    md_candidates = [p for p in by_ext.get(".md", [])
                     if p.name not in ("note.md", "staging plan.md")]
    md_candidates.sort(key=lambda p: p.stat().st_size, reverse=True)
    report_md = md_candidates[0] if md_candidates else None

    # Pick the data file: prefer GeoJSON, else CSV with lat/lng columns,
    # else the most-recent CSV.
    data_file = None
    data_kind = None
    if by_ext.get(".geojson"):
        data_file = sorted(by_ext[".geojson"], key=lambda p: p.stat().st_mtime)[-1]
        data_kind = "geojson"
    elif by_ext.get(".csv"):
        csv_with_coords = []
        for c in by_ext[".csv"]:
            with c.open(encoding="utf-8") as f:
                header = next(csv.reader(f), [])
            cols = [h.lower() for h in header]
            if "latitude" in cols and "longitude" in cols:
                csv_with_coords.append(c)
        pool = csv_with_coords or by_ext[".csv"]
        data_file = sorted(pool, key=lambda p: p.stat().st_mtime)[-1]
        data_kind = "csv"

    images = [p for p in (by_ext.get(".png", []) + by_ext.get(".jpg", []) + by_ext.get(".jpeg", []))]

    slug = front.get("slug")
    if not slug and report_md:
        first_h1 = re.search(r"^#\s+(.+)$", report_md.read_text(encoding="utf-8"), re.MULTILINE)
        if first_h1:
            slug = re.sub(r"[^a-z0-9]+", "-", first_h1.group(1).lower()).strip("-")

    plan = {
        "staging_dir": str(STAGING.relative_to(REPO_ROOT)),
        "files": [str(p.relative_to(STAGING)) for p in files],
        "front_matter": front,
        "slug": slug,
        "report_md": str(report_md.relative_to(REPO_ROOT)) if report_md else None,
        "data_file": str(data_file.relative_to(REPO_ROOT)) if data_file else None,
        "data_kind": data_kind,
        "images": [str(p.relative_to(REPO_ROOT)) for p in images],
        "produce": front.get("produce", ["app", "storymap", "report"]),
    }
    return plan


# ─── CSV → GeoJSON ───────────────────────────────────────────────────────────

def csv_to_geojson(csv_path: Path, out_path: Path) -> dict:
    """Convert a CSV to a Point FeatureCollection. Skip rows missing lat/lng.

    Returns a summary dict with `features_written`, `rows_skipped`, and the
    list of skipped row names so the caller can surface them clearly.
    """
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    # Tolerate Latitude/LATITUDE/etc.
    lat_key = next((c for c in fieldnames if c.lower() == "latitude"), None)
    lng_key = next((c for c in fieldnames if c.lower() == "longitude"), None)
    if not lat_key or not lng_key:
        raise SystemExit(
            f"ERROR: CSV must have 'latitude' and 'longitude' columns. Found: {fieldnames}"
        )

    name_key = next((c for c in fieldnames if c.lower() == "name"), fieldnames[0])

    features = []
    skipped: list[str] = []
    for row in rows:
        try:
            lat = float((row.get(lat_key) or "").strip())
            lng = float((row.get(lng_key) or "").strip())
        except ValueError:
            skipped.append(row.get(name_key, "(unnamed)").strip())
            continue
        # Drop coord cols from properties (geometry already carries them)
        props = {k: v for k, v in row.items() if k not in (lat_key, lng_key) and v != ""}
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": props,
        })

    fc = {"type": "FeatureCollection", "features": features}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(fc, indent=2), encoding="utf-8")

    return {
        "features_written": len(features),
        "rows_total": len(rows),
        "rows_skipped": len(skipped),
        "skipped_names": skipped,
        "out_path": str(out_path.relative_to(REPO_ROOT)),
    }


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(description="Staging intake helpers")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("triage", help="Print a JSON plan derived from assets/staging/")

    c = sub.add_parser("csv-to-geojson", help="Convert a CSV (with latitude/longitude) to GeoJSON")
    c.add_argument("--csv", required=True)
    c.add_argument("--out", required=True)

    args = p.parse_args()

    if args.cmd == "triage":
        print(json.dumps(triage(), indent=2))
        return 0
    if args.cmd == "csv-to-geojson":
        summary = csv_to_geojson(Path(args.csv).resolve(), Path(args.out).resolve())
        print(json.dumps(summary, indent=2))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
