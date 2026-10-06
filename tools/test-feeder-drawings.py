from pathlib import Path
import json
import math
import re

import ezdxf
from ezdxf import bbox
from ezdxf.addons.drawing import matplotlib

DXF = Path("/tmp/final-dispatch.dxf")
FEEDERS = Path("data/feeders/feeders.json")
OUT = Path("data/feeders/test-drawings")
OUT.mkdir(parents=True, exist_ok=True)

TEST_FEEDERS = ["F-8.13", "FDR#2.20", "BSP.F-15"]

print("Loading DXF...")
doc = ezdxf.readfile(DXF)
msp = doc.modelspace()

feeders = {
    x["name"]: x
    for x in json.loads(FEEDERS.read_text(encoding="utf-8"))
}

cache = bbox.Cache()

print("Indexing drawable entities...")
indexed = []
for entity in msp:
    try:
        box = bbox.extents([entity], cache=cache)
        if box.has_data:
            indexed.append((entity, box))
    except Exception:
        pass

print(f"Indexed {len(indexed)} entities")

def clusters_for(positions, threshold=2500.0):
    clusters = []
    for p in positions:
        x = float(p["x"])
        y = float(p["y"])
        for c in clusters:
            cx = sum(a for a, _ in c) / len(c)
            cy = sum(b for _, b in c) / len(c)
            if math.hypot(x-cx, y-cy) <= threshold:
                c.append((x, y))
                break
        else:
            clusters.append([(x, y)])

    # Merge nearby clusters so one feeder section is not split unnecessarily.
    changed = True
    while changed:
        changed = False
        for i in range(len(clusters)):
            if changed:
                break
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                ax = sum(x for x, _ in a)/len(a)
                ay = sum(y for _, y in a)/len(a)
                bx = sum(x for x, _ in b)/len(b)
                by = sum(y for _, y in b)/len(b)
                if math.hypot(ax-bx, ay-by) <= threshold * 1.5:
                    clusters[i] = a + b
                    clusters.pop(j)
                    changed = True
                    break
    return clusters

def safe(s):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", s)

for name in TEST_FEEDERS:
    if name not in feeders:
        print(f"WARNING: {name} not found")
        continue

    positions = feeders[name].get("positions", [])
    clusters = clusters_for(positions)

    print(f"{name}: {len(positions)} occurrences, {len(clusters)} drawing view(s)")

    for idx, points in enumerate(clusters, 1):
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        width = max_x - min_x
        height = max_y - min_y
        pad = max(600.0, min(5000.0, max(width, height) * 0.45))

        lo_x, hi_x = min_x-pad, max_x+pad
        lo_y, hi_y = min_y-pad, max_y+pad

        def visible(entity, lo_x=lo_x, hi_x=hi_x, lo_y=lo_y, hi_y=hi_y):
            try:
                box = bbox.extents([entity], cache=cache)
                if not box.has_data:
                    return False
                return not (
                    box.extmax.x < lo_x or box.extmin.x > hi_x or
                    box.extmax.y < lo_y or box.extmin.y > hi_y
                )
            except Exception:
                return False

        out = OUT / f"{safe(name)}__{idx:02d}.png"
        print(f"  rendering {out}")
        matplotlib.qsave(
            msp,
            str(out),
            dpi=140,
            bg="#FFFFFF",
            fg="#111111",
            filter_func=visible,
            size_inches=(12, 8),
        )

print("TEST DRAWINGS COMPLETE")
