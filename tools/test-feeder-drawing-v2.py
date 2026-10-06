from pathlib import Path
import json
import re

import ezdxf
from ezdxf import bbox
from ezdxf.addons.drawing import matplotlib

DXF = Path("/tmp/final-dispatch.dxf")
FEEDERS = Path("data/feeders/feeders.json")
OUT = Path("data/feeders/drawings")
OUT.mkdir(parents=True, exist_ok=True)

TEST_FEEDERS = ["F-8.13"]

doc = ezdxf.readfile(DXF)
msp = doc.modelspace()
feeders = {x["name"]: x for x in json.loads(FEEDERS.read_text(encoding="utf-8"))}
cache = bbox.Cache()

indexed = []
for entity in msp:
    try:
        box = bbox.extents([entity], cache=cache)
        if box.has_data:
            indexed.append((entity, box))
    except Exception:
        pass

def rectangle(e):
    try:
        if e.dxftype() == "LWPOLYLINE":
            if not e.closed:
                return None
            pts = [(p[0], p[1]) for p in e.get_points("xy")]
        elif e.dxftype() == "POLYLINE":
            if not e.is_closed:
                return None
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        else:
            return None
        if len(pts) < 4:
            return None
        xs, ys = zip(*pts)
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        w, h = maxx-minx, maxy-miny
        if w <= 0 or h <= 0 or w*h <= 1e5:
            return None
        tol = max(w, h) * 0.01
        if not all(
            min(abs(x-minx), abs(x-maxx)) <= tol or
            min(abs(y-miny), abs(y-maxy)) <= tol
            for x, y in pts
        ):
            return None
        return (minx, miny, maxx, maxy, w*h)
    except Exception:
        return None

frames = []
for entity, _ in indexed:
    r = rectangle(entity)
    if r:
        frames.append(r)

# Also find large rectangular frames made from LINE entities.
lines = []
for entity, _ in indexed:
    if entity.dxftype() != "LINE":
        continue
    try:
        a, b = entity.dxf.start, entity.dxf.end
        x1,y1,x2,y2 = float(a.x),float(a.y),float(b.x),float(b.y)
        if abs(x1-x2) < 1e-6 or abs(y1-y2) < 1e-6:
            lines.append((x1,y1,x2,y2))
    except Exception:
        pass

tol = 2.0
def has_vertical(x, lo, hi):
    for a,b,c,d in lines:
        if abs(a-c) < 1e-6 and abs(a-x) <= tol:
            y1,y2 = sorted((b,d))
            if y1 <= lo+tol and y2 >= hi-tol:
                return True
    return False

for x1,y1,x2,y2 in lines:
    if abs(y1-y2) >= 1e-6:
        continue
    left0,right0 = sorted((x1,x2))
    for x3,y3,x4,y4 in lines:
        if abs(x3-x4) >= 1e-6:
            continue
        vx=x3
        if abs(vx-left0)>tol and abs(vx-right0)>tol:
            continue
        for x5,y5,x6,y6 in lines:
            if abs(y5-y6)>=1e-6 or abs(y5-y1)<=tol:
                continue
            left,right=(vx,right0) if abs(vx-left0)<=tol else (left0,vx)
            lo,hi=sorted((y1,y5))
            if right-left > 100 and hi-lo > 100 and has_vertical(left,lo,hi) and has_vertical(right,lo,hi):
                frames.append((left,lo,right,hi,(right-left)*(hi-lo)))

uniq=[]
seen=set()
for f in sorted(frames,key=lambda z:z[4]):
    key=tuple(round(v,1) for v in f[:4])
    if key not in seen:
        seen.add(key)
        uniq.append(f)
frames=uniq

print(f"Indexed entities: {len(indexed)}")
print(f"Detected drawing frames: {len(frames)}")

def inside(box, lo_x, lo_y, hi_x, hi_y):
    return not (box.extmax.x < lo_x or box.extmin.x > hi_x or box.extmax.y < lo_y or box.extmin.y > hi_y)

def safe(s):
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", s)

for name in TEST_FEEDERS:
    data=feeders.get(name)
    if not data:
        raise SystemExit(f"NOT FOUND: {name}")

    positions=data.get("positions", [])
    matched=[]
    for p in positions:
        x,y=float(p["x"]),float(p["y"])
        candidates=[f for f in frames if f[0] <= x <= f[2] and f[1] <= y <= f[3]]
        if candidates:
            f=min(candidates,key=lambda z:z[4])
            if f not in matched:
                matched.append(f)

    if not matched:
        raise SystemExit(f"No drawing frame found for {name}")

    print(f"{name}: {len(positions)} labels -> {len(matched)} frame(s)")

    # If a feeder spans multiple frames, render the union so the web view remains one complete drawing.
    minx=min(f[0] for f in matched); miny=min(f[1] for f in matched)
    maxx=max(f[2] for f in matched); maxy=max(f[3] for f in matched)
    w=maxx-minx; h=maxy-miny
    pad=max(150.0,min(1200.0,max(w,h)*0.025))
    lo_x,lo_y=minx-pad,miny-pad
    hi_x,hi_y=maxx+pad,maxy+pad

    def visible(entity):
        try:
            b=bbox.extents([entity],cache=cache)
            return b.has_data and inside(b,lo_x,lo_y,hi_x,hi_y)
        except Exception:
            return False

    # High-resolution raster, kept below GitHub's 100 MB single-file limit.
    aspect=max(w,1)/max(h,1)
    max_px=11000
    if aspect >= 1:
        width_px=max_px
        height_px=max(1,round(max_px/aspect))
    else:
        height_px=max_px
        width_px=max(1,round(max_px*aspect))

    out=OUT/f"{safe(name)}.png"
    for dpi in (180,150,125,105,90):
        size_inches=(width_px/dpi,height_px/dpi)
        print(f"Rendering {name} at {width_px}x{height_px} px ({dpi} dpi)...")
        matplotlib.qsave(
            msp, str(out), dpi=dpi,
            bg="#FFFFFF", fg="#111111",
            filter_func=visible,
            size_inches=size_inches,
        )
        size=out.stat().st_size
        print(f"Output size: {size/1024/1024:.1f} MB")
        if size < 90*1024*1024:
            break
    else:
        raise SystemExit("Drawing is still above 90 MB; refusing to commit it.")

    manifest={
        "feeder": name,
        "format": "PNG",
        "completeDrawing": True,
        "width": width_px,
        "height": height_px,
        "sourceFrames": len(matched),
        "source": "cad/FINAL DISPATCH - UPDATE.dwg"
    }
    (OUT/f"{safe(name)}.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")

print("DONE")
