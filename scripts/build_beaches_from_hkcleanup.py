"""Rebuild beaches.json from the hkcleanup.org Coastal Map markers.

The hkcleanup map is the canonical source for which beaches we cover and
where they sit. We use the marker list to drive the file, parse the
description blob into structured fields (cleaning frequency, transport,
difficulty, coastal length) for display, and inherit engine-relevant
metadata (orientation, exposure, nearestStations, etc.) from the
existing beaches.json wherever the names line up.

Matching is name-only (Chinese first, then case-insensitive English).
A proximity-based fallback used to silently merge two adjacent but
distinct beaches (Kwun Yam ↔ Cheung Chau Tung Wan are 300m apart) so
that's been removed — better to leave a new beach with engine defaults
than to assert it's the same beach we already had.

historicalWeight is left alone. It encodes how likely debris is to be
swept onto that beach — purely a function of exposure / current —
which is independent of how often the LCSD cleans it. Cleaning
frequency is displayed alongside the prediction, not folded into it.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project")
HK_MARKERS = Path("/tmp/ml.json")
OUTPUT = [
    ROOT / "server/data/beaches.json",
    ROOT / "functions/data/beaches.json",
]
EXISTING = ROOT / "server/data/beaches.json"

ENGINE_FIELDS = (
    "orientation",
    "exposure",
    "bayFactor",
    "nearestStations",
    "historicalWeight",
    "accessDifficulty",
    "roadTier",
    "hikeGrade",
    "placeId",
    "boatOnly",
    "hikeMinutes",
)


def split_title(title):
    """Split 'English Name 中文名 (extra)' into (english, chinese)."""
    cleaned = title.strip().replace("\\'", "'")
    cjk_match = re.search(r"[㐀-鿿]", cleaned)
    if not cjk_match:
        return cleaned, None
    idx = cjk_match.start()
    english = cleaned[:idx].strip(" \t/-,")
    chinese = cleaned[idx:].strip()
    english = re.sub(r"\s*\([^)]*\)\s*$", "", english).strip()
    chinese = re.sub(r"[\)\s]+$", "", chinese).strip()
    chinese = re.sub(r"\s*\([^)]*\)\s*$", "", chinese).strip()
    return english, chinese


def parse_description(desc):
    """Pull the four labelled fields out of an hkcleanup description.

    Descriptions arrive in two layouts (single-line "// "-separated and
    multi-line label/value blocks). Both share the same labels, so a
    label-anchored regex works for either."""
    if not desc:
        return {}
    text = desc.replace("\r", "")
    fields = {
        "Cleaning Frequency": "cleaningFrequency",
        "Transport": "transportNotes",
        "Level": "difficultyNote",
        "Difficulty": "difficultyNote",
        "Coastal Length": "coastalLength",
    }
    out = {}
    parts = [p.strip() for p in re.split(r"\s*//\s*", text) if p.strip()]
    for part in parts:
        for label, key in fields.items():
            m = re.match(rf"^{re.escape(label)}\s*[^:]*:\s*(.+)$", part, re.S)
            if m:
                value = m.group(1).strip()
                value = re.sub(r"\s+", " ", value)
                out[key] = value
                break
        else:
            out.setdefault("note", re.sub(r"\s+", " ", part))
    return out


def detect_region(lat, lng):
    if 22.19 <= lat <= 22.22 and 114.02 <= lng <= 114.05:
        return "Cheung Chau"
    if 22.27 <= lat <= 22.30 and 114.03 <= lng <= 114.05:
        return "Peng Chau"
    if 22.18 <= lat <= 22.23 and 114.09 <= lng <= 114.16:
        return "Lamma"
    if 22.18 <= lat <= 22.30 and 113.82 <= lng <= 114.05:
        return "Lantau"
    if 22.19 <= lat <= 22.30 and 114.13 <= lng <= 114.27:
        return "HK Island"
    if 22.34 <= lat <= 22.42 and 113.88 <= lng <= 114.02:
        return "Tuen Mun"
    if 22.33 <= lat <= 22.42 and 114.04 <= lng <= 114.13:
        return "Tsuen Wan"
    if 22.40 <= lat <= 22.46 and 114.18 <= lng <= 114.25:
        return "Sha Tin"
    if 22.42 <= lat <= 22.50 and 114.14 <= lng <= 114.27:
        return "Tai Po"
    if lat >= 22.46 and 114.25 <= lng <= 114.45:
        return "North"
    if 22.28 <= lat <= 22.50 and 114.23 <= lng <= 114.42:
        return "Sai Kung"
    return "Sai Kung"


def is_gazetted_from_title(_english, chinese):
    return bool(chinese and "泳灘" in chinese)


def is_marine_park(title):
    return ("Marine Park" in title
            or "海岸公園" in title
            or "海岸公园" in title)


def main():
    raw = json.loads(HK_MARKERS.read_text(encoding="utf-8"))
    markers = raw["meta"]
    existing = json.loads(EXISTING.read_text(encoding="utf-8"))
    by_tc = {}
    by_en = {}
    for b in existing:
        if b.get("nameTc"):
            by_tc.setdefault(b["nameTc"], b)
        by_en.setdefault(b["name"].lower(), b)

    seen = set()
    out = []
    matched_count = 0
    for m in markers:
        try:
            lat = float(m["lat"])
            lng = float(m["lng"])
        except (KeyError, ValueError):
            continue
        if lat < 22 or lat > 23 or lng < 113 or lng > 115:
            continue

        en, tc = split_title(m["title"])
        en = en.replace("’", "'").strip()
        debris = parse_description(m.get("description", ""))

        match = None
        if tc and tc in by_tc:
            match = by_tc[tc]
        if match is None and en and en.lower() in by_en:
            match = by_en[en.lower()]
        if match and id(match) in seen:
            match = None

        # Always keep the hkcleanup name + coordinates verbatim. We only
        # inherit engine-relevant metadata from the existing record so
        # an adjacent-but-different beach can never silently take over
        # another's identity.
        record = {
            "name": en or m["title"].strip(),
            "nameTc": tc,
            "region": detect_region(lat, lng),
            "lat": lat,
            "lng": lng,
        }

        if match:
            seen.add(id(match))
            matched_count += 1
            record["region"] = match.get("region", record["region"])
            record["gazetted"] = match.get(
                "gazetted", is_gazetted_from_title(en, tc)
            )
            record["isBeach"] = match.get(
                "isBeach", not is_marine_park(m["title"])
            )
            for field in ENGINE_FIELDS:
                if field in match and match[field] is not None:
                    record[field] = match[field]
        else:
            record["gazetted"] = is_gazetted_from_title(en, tc)
            record["isBeach"] = not is_marine_park(m["title"])

        # Engine-field defaults applied to every record (matched or not).
        # Original beaches.json wasn't fully consistent — some entries
        # only had wind metadata — so the prediction engine still needs
        # safe values for the fields the existing record didn't carry.
        defaults = {
            "orientation": 180,
            "nearestStations": [],
            "exposure": 0.5,
            "bayFactor": 0.5,
            "historicalWeight": 0.4,
            "accessDifficulty": 3,
            "roadTier": "road",
            "hikeGrade": "rolling",
        }
        for k, v in defaults.items():
            record.setdefault(k, v)

        if debris:
            record["debris"] = debris

        out.append(record)

    out.sort(key=lambda b: (b["region"], b["name"]))

    payload = json.dumps(out, ensure_ascii=False, indent=2)
    for path in OUTPUT:
        path.write_text(payload + "\n", encoding="utf-8")
    print(
        f"wrote {len(out)} beaches "
        f"({matched_count} matched existing, {len(out) - matched_count} new); "
        f"{sum(1 for b in out if b.get('debris'))} have debris info",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
