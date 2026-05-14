"""Translate hkcleanup's parsed difficulty/transport notes into the
engine's accessDifficulty / roadTier / hikeGrade fields for beaches that
don't already have hand-tuned values.

Detection rule for "still on rebuild defaults": accessDifficulty===3 AND
roadTier==='road' AND hikeGrade==='rolling' AND no placeId (matched
beaches inherited placeIds from the rich blob; new beaches don't have
them). That keeps the engine's existing tuning untouched.

Difficulty mapping (LCSD's notes describe age-group accessibility, not
literal hike grade — a "Middle / >16 years old" beach is something with
some scrambling or longer transit, not necessarily steep):
  Low    -> accessDifficulty 1, hikeGrade flat
  Middle -> accessDifficulty 3, hikeGrade rolling
  High   -> accessDifficulty 4, hikeGrade steep

Transport mapping:
  has Bus/MTR/Minibus -> roadTier 'road'
  ferry-only          -> roadTier 'ferry'
  kaito/charter/街渡  -> roadTier 'kaito'
  no transport listed -> roadTier 'remote' and bump accessDifficulty +1
"""
import json
import re
from pathlib import Path

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project")
PATHS = [
    ROOT / "server/data/beaches.json",
    ROOT / "functions/data/beaches.json",
]


# Per-field default values from build_beaches_from_hkcleanup.py. Each
# guard is independent: a beach whose accessDifficulty was tuned by the
# neighbour-inheritance pass but still has the rolling-grade default
# should still get a hikeGrade refinement from hkcleanup if available.
DEFAULT_ACCESS = 3
DEFAULT_ROAD = "road"
DEFAULT_GRADE = "rolling"


def classify_difficulty(note):
    """Return one of 'low' | 'middle' | 'high' or None."""
    if not note:
        return None
    m = re.match(r"\s*(Low|Middle|High|Hard|Easy)", note, re.I)
    if not m:
        # Chinese fallbacks
        if "低難度" in note or "低难度" in note:
            return "low"
        if "中難度" in note or "中难度" in note:
            return "middle"
        if "高難度" in note or "高难度" in note:
            return "high"
        return None
    word = m.group(1).lower()
    if word in ("low", "easy"):
        return "low"
    if word == "middle":
        return "middle"
    if word in ("high", "hard"):
        return "high"
    return None


def classify_transport(note):
    """Return roadTier label from a transport note."""
    if not note:
        return "remote"
    n = note.lower()
    has_road = (
        "bus" in n or "mtr" in n or "minibus" in n
        or "巴士" in note or "小巴" in note or "港鐵" in note
        or "light rail" in n or "輕鐵" in note
    )
    has_ferry = (
        "ferry" in n or "pier" in n
        or "渡輪" in note or "小輪" in note or "碼頭" in note
    )
    has_kaito = (
        "kaito" in n or "charter" in n or "sampan" in n
        or "街渡" in note
    )
    if has_road:
        return "road"
    if has_ferry:
        return "ferry"
    if has_kaito:
        return "kaito"
    return "remote"


def main():
    beaches = json.loads(PATHS[0].read_text(encoding="utf-8"))
    counts = {"access": 0, "road": 0, "grade": 0}
    for b in beaches:
        debris = b.get("debris") or {}
        diff = classify_difficulty(debris.get("difficultyNote"))
        road = classify_transport(debris.get("transportNotes"))

        if diff == "low":
            access_val, grade_val = 1, "flat"
        elif diff == "middle":
            access_val, grade_val = 3, "rolling"
        elif diff == "high":
            access_val, grade_val = 4, "steep"
        else:
            access_val, grade_val = None, None

        # Remote beaches without listed transport tend to need a hike or
        # boat — bump the implied access if it's softer than that.
        if road == "remote" and access_val is not None:
            access_val = max(access_val, 4)
            if grade_val == "flat":
                grade_val = "rolling"
        elif road == "kaito" and access_val is not None:
            access_val = max(access_val, 3)

        # Per-field guards: only fill when the existing value is still
        # the rebuild default. Hand-tuned and neighbour-inherited values
        # take precedence.
        if access_val is not None and b.get("accessDifficulty") == DEFAULT_ACCESS:
            b["accessDifficulty"] = access_val
            counts["access"] += 1
        if road and b.get("roadTier") == DEFAULT_ROAD and road != DEFAULT_ROAD:
            b["roadTier"] = road
            counts["road"] += 1
        if grade_val is not None and b.get("hikeGrade") == DEFAULT_GRADE and grade_val != DEFAULT_GRADE:
            b["hikeGrade"] = grade_val
            counts["grade"] += 1

    payload = json.dumps(beaches, ensure_ascii=False, indent=2)
    for p in PATHS:
        p.write_text(payload + "\n", encoding="utf-8")

    print(f"updated: {counts}")


if __name__ == "__main__":
    main()
