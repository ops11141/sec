#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path("data")
SOURCE = Path("equipment.html")
OUT = ROOT / "equipment-lookup.json"

text = SOURCE.read_text(encoding="utf-8")
match = re.search(r"const DATA=(\[[\s\S]*?\]);\s*[\r\n]+", text)
if not match:
    raise RuntimeError("Could not find embedded equipment DATA in equipment.html")

data = json.loads(match.group(1))
records = {}

def norm(value):
    return re.sub(r"[\s\-_/.,:;()\[\]{}#\\]+", "", str(value or "").strip().upper())

for row in data:
    if not isinstance(row, dict):
        continue
    tf = str(row.get("TF", "")).strip()
    try:
        lon = float(row.get("X"))
        lat = float(row.get("Y"))
    except (TypeError, ValueError):
        continue
    if not tf or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        continue

    key = norm(tf)
    records.setdefault(key, []).append([
        tf,
        lat,
        lon,
        str(row.get("COORDIATE", "")).strip()
    ])

for key, rows in records.items():
    seen = set()
    clean = []
    for row in rows:
        sig = (row[0].upper(), row[1], row[2])
        if sig in seen:
            continue
        seen.add(sig)
        clean.append(row)
    records[key] = clean

payload = {
    "version": 2,
    "source": "equipment.html embedded DATA",
    "recordCount": len(data),
    "keys": len(records),
    "records": records,
}

OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Created {OUT}: {OUT.stat().st_size} bytes, {len(data)} source records, {len(records)} keys")
