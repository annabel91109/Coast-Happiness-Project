"""Merge the 8 high-priority debris hotspots back into beaches.json.

These weren't on the hkcleanup Coastal Map (it lists swim beaches and
publicised cleanup sites), but they're known accumulation points the
prediction engine had hand-tuned data for. Pulled from the rich working-
tree snapshot recovered earlier in the session.
"""
import json
from pathlib import Path

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project")
RICH = Path("/tmp/beaches-rich.json")
PATHS = [
    ROOT / "server/data/beaches.json",
    ROOT / "functions/data/beaches.json",
]
WANTED = [
    "Po Chue Tam",
    "Sandy Bay",
    "Sam Pak Wan, Lantau",
    "Lo Tik Wan, Lamma",
    "Cheung Sha Lan, Lantau Island",
    "Mui Wo Beach",
    "Chek Keng Beach",
    "Peng Chau Tung Wan Beach",
]

rich = json.loads(RICH.read_text(encoding="utf-8"))
current = json.loads(PATHS[0].read_text(encoding="utf-8"))
existing_names = {b["name"] for b in current}
existing_tc = {b.get("nameTc") for b in current if b.get("nameTc")}

added = []
for name in WANTED:
    src = next((b for b in rich if b["name"] == name), None)
    if not src:
        print(f"  not in rich blob: {name}")
        continue
    if src["name"] in existing_names or src.get("nameTc") in existing_tc:
        print(f"  already present, skipping: {src['name']}")
        continue
    current.append(src)
    added.append(src["name"])

current.sort(key=lambda b: (b["region"], b["name"]))

payload = json.dumps(current, ensure_ascii=False, indent=2)
for p in PATHS:
    p.write_text(payload + "\n", encoding="utf-8")

print(f"\nadded {len(added)} beaches; total now {len(current)}")
for n in added:
    print(f"  + {n}")
