"""Clean up the beach list: drop non-beaches and near-duplicates, fix
spelling and coordinate bugs surfaced by audit."""
import json
from pathlib import Path

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project")
PATHS = [
    ROOT / "server/data/beaches.json",
    ROOT / "functions/data/beaches.json",
]

# Entries to remove entirely. Marine parks are conservation areas, the
# "natural rocky shore" name speaks for itself, the islands-group and
# whole-island entries don't designate a specific beach.
TO_REMOVE = {
    "Hoi Ha Wan Marine Park",
    "Tung Ping Chau Marine Park",
    "Yan Chau Tong Marine Park",
    "Shau Chau & Lung Kwu Chau Marine Park",
    "Lei Yue Mun natural rocky shore",
    "Kwo Chau Islands, Ninepin Group",
    "Grass Island",
    # Near-duplicates of other entries (same coords / same place).
    "Hairpin Beach",         # identical coords with Stanley Main Beach
    "Siu Chung Lam Wan",     # 小棕林灣 == 小棕林 (Little Palm), 32m apart
}

# Per-name patches. Keyed by current name.
PATCHES = {
    # The original rich blob had Cheung Sha Lan at Discovery Bay
    # coordinates (22.289, 114.019) — wrong location. The real Cheung
    # Sha Lan, the PFS cleanup hotspot, sits between Upper and Lower
    # Cheung Sha on south Lantau.
    "Cheung Sha Lan, Lantau Island": {
        "name": "Cheung Sha Lan",
        "nameTc": "長沙欄",
        "lat": 22.23380,
        "lng": 113.95140,
    },
    # Tai Wan To's Chinese name leaked an unclosed parenthesis from
    # the hkcleanup title "(Power Station Beach)".
    "Tai Wan To": {
        "nameTc": "大灣肚",
    },
    # Drop the "Lantau Island" / "Lamma" suffixes the rich blob baked
    # into the English name — the region field already says so.
    "Sam Pak Wan, Lantau": {"name": "Sam Pak Wan"},
    "Lo Tik Wan, Lamma": {"name": "Lo Tik Wan"},
    "Shek Pai Wan, Lamma Island": {"name": "Shek Pai Wan"},
    "Lo Kei Wan, Lantau": {"name": "Lo Kei Wan"},
}


def main():
    beaches = json.loads(PATHS[0].read_text(encoding="utf-8"))
    removed = []
    patched = []
    out = []
    for b in beaches:
        if b["name"] in TO_REMOVE:
            removed.append(b["name"])
            continue
        if b["name"] in PATCHES:
            patch = PATCHES[b["name"]]
            patched.append((b["name"], patch))
            for k, v in patch.items():
                b[k] = v
        out.append(b)

    out.sort(key=lambda x: (x["region"], x["name"]))

    payload = json.dumps(out, ensure_ascii=False, indent=2)
    for p in PATHS:
        p.write_text(payload + "\n", encoding="utf-8")

    print(f"before: {len(beaches)}  after: {len(out)}")
    print(f"\nremoved ({len(removed)}):")
    for n in removed:
        print(f"  - {n}")
    print(f"\npatched ({len(patched)}):")
    for n, p in patched:
        print(f"  ~ {n} → {p}")


if __name__ == "__main__":
    main()
