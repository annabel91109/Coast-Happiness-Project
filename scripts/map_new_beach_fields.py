"""Fill in engine fields for beaches that the hkcleanup rebuild left at
defaults (orientation=180, empty nearestStations, exposure=0.5, etc.).

The signal we already have is good: every "old" beach in beaches.json has
hand-tuned values that encode local geography — which way the beach faces,
how exposed it is, and which HKO stations sit upwind. For each new beach
we find its 3 nearest neighbours that *do* carry this metadata, then:

- Pick the 2 most-cited neighbour stations as nearestStations.
- Vector-average their orientations (so 350° + 10° collapses to North).
- Distance-weighted-average their exposure and bayFactor.
- Snap accessDifficulty to the closest neighbour's value (rounded down for
  remote-feeling locations beyond 0.6km from any neighbour).

This is best-effort, not ground truth. Beaches that genuinely face a
different aspect than their neighbours (e.g. an east-facing cove inside
a west-facing bay) will be wrong until someone tunes them by hand. The
defaults are at least more useful than the placeholder 180/0.5/0.5.
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project")
PATHS = [
    ROOT / "server/data/beaches.json",
    ROOT / "functions/data/beaches.json",
]


def haversine_km(a, b, c, d):
    R = 6371
    dlat = math.radians(c - a)
    dlng = math.radians(d - b)
    h = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(a)) * math.cos(math.radians(c)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def is_unmapped(beach):
    """A beach left with the safe defaults from build_beaches_from_hkcleanup."""
    return (
        not beach.get("nearestStations")
        or len(beach.get("nearestStations") or []) == 0
    )


def vector_average_degrees(values, weights):
    """Average angles by summing unit vectors weighted by `weights`.
    Returns degrees in [0, 360)."""
    sx = sum(w * math.sin(math.radians(d)) for d, w in zip(values, weights))
    sy = sum(w * math.cos(math.radians(d)) for d, w in zip(values, weights))
    if sx == 0 and sy == 0:
        return values[0]
    angle = math.degrees(math.atan2(sx, sy))
    return (angle + 360) % 360


def fill_one(beach, donors):
    """Pick metadata from the K nearest donors that have it."""
    # Distance-weighted (inverse) so a 200m neighbour outranks a 4km one.
    weighted = [(d, max(0.05, 1.0 / max(0.2, dist_km)), dist_km)
                for d, dist_km in donors]

    # nearestStations: take the most cited stations across all donors.
    station_counts = Counter()
    for d, w, _ in weighted:
        for s in d.get("nearestStations") or []:
            station_counts[s] += w
    top = [s for s, _ in station_counts.most_common(2)]
    if top:
        beach["nearestStations"] = top

    orientations = [(d.get("orientation"), w) for d, w, _ in weighted
                    if d.get("orientation") is not None]
    if orientations:
        beach["orientation"] = round(
            vector_average_degrees([o for o, _ in orientations],
                                    [w for _, w in orientations]), 1
        )

    def wavg(field):
        nums = [(d.get(field), w) for d, w, _ in weighted
                if isinstance(d.get(field), (int, float))]
        if not nums:
            return None
        return sum(v * w for v, w in nums) / sum(w for _, w in nums)

    exp = wavg("exposure")
    if exp is not None:
        beach["exposure"] = round(exp, 2)
    bay = wavg("bayFactor")
    if bay is not None:
        beach["bayFactor"] = round(bay, 2)

    # accessDifficulty: closest neighbour's value, bumped if the new beach
    # sits >800m from any donor (likely a wilder spot).
    closest = weighted[0]
    if closest[0].get("accessDifficulty") is not None:
        diff = closest[0]["accessDifficulty"]
        if closest[2] > 0.8 and diff < 5:
            diff = min(5, diff + 1)
        beach["accessDifficulty"] = diff

    # roadTier / hikeGrade: copy the closest donor's values when present —
    # they're descriptive enough that interpolating wouldn't make sense.
    for f in ("roadTier", "hikeGrade"):
        if f not in beach and f in closest[0]:
            beach[f] = closest[0][f]

    return beach


def main():
    beaches = json.loads(PATHS[0].read_text(encoding="utf-8"))
    donors_pool = [b for b in beaches if not is_unmapped(b)]
    if not donors_pool:
        print("no donor beaches found", file=sys.stderr)
        return 1

    targets = [b for b in beaches if is_unmapped(b)]
    print(f"donors: {len(donors_pool)}  targets: {len(targets)}",
          file=sys.stderr)

    for beach in targets:
        donors = [
            (d, haversine_km(beach["lat"], beach["lng"], d["lat"], d["lng"]))
            for d in donors_pool
        ]
        donors.sort(key=lambda x: x[1])
        fill_one(beach, donors[:3])

    payload = json.dumps(beaches, ensure_ascii=False, indent=2)
    for path in PATHS:
        path.write_text(payload + "\n", encoding="utf-8")

    still_unmapped = [b["name"] for b in beaches if is_unmapped(b)]
    print(f"updated {len(targets)} beaches; still unmapped: "
          f"{len(still_unmapped)}", file=sys.stderr)
    if still_unmapped:
        print(" -", *still_unmapped, sep="\n - ", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main() or 0)
