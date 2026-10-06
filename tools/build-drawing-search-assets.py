#!/usr/bin/env python3
from pathlib import Path
import json
import math
import ezdxf
from ezdxf import bbox
from ezdxf.addons.drawing import matplotlib
from ezdxf.addons.drawing.properties import RenderContext, LayoutProperties
from ezdxf.addons.drawing.frontend import Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.config import Configuration
import matplotlib.pyplot as plt
from PIL import Image

DXF = Path("/tmp/final-dispatch.dxf")
OUT_DIR = Path("data/feeders")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEARCH_IMAGE = OUT_DIR / "drawing-search.jpg"
SEARCH_INDEX = OUT_DIR / "drawing-search-index.json"

doc = ezdxf.readfile(DXF)
msp = doc.modelspace()

# Use the same model-space drawing that the CAD viewer shows.
ext = bbox.extents(msp)
xmin, ymin = float(ext.extmin.x), float(ext.extmin.y)
xmax, ymax = float(ext.extmax.x), float(ext.extmax.y)

if not all(math.isfinite(v) for v in (xmin, ymin, xmax, ymax)) or xmax <= xmin or ymax <= ymin:
    raise RuntimeError(f"Invalid drawing extents: {(xmin, ymin, xmax, ymax)}")

def clean_text(value):
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\\P", " ").replace("\\~", " ")
    return " ".join(text.split()).strip()

def normalize(value):
    return "".join(ch for ch in clean_text(value).lower() if ch not in " \\t\\r\\n-_.#/\\").strip()

entries = []
types = {"TEXT", "MTEXT", "ATTRIB", "ATTDEF"}

for entity in msp:
    if entity.dxftype() not in types:
        continue
    try:
        if entity.dxftype() == "MTEXT":
            value = entity.plain_text()
        else:
            value = entity.dxf.text
        value = clean_text(value)
        pos = entity.dxf.insert
        x, y = float(pos.x), float(pos.y)
        if not value or not math.isfinite(x) or not math.isfinite(y):
            continue
        entries.append({
            "t": value[:240],
            "n": normalize(value)[:240],
            "x": round(x, 4),
            "y": round(y, 4),
        })
    except Exception:
        continue

# Include attribute/attribute-definition text from block references too.
try:
    for insert in msp.query("INSERT"):
        for attrib in insert.attribs:
            try:
                value = clean_text(attrib.dxf.text)
                pos = attrib.dxf.insert
                x, y = float(pos.x), float(pos.y)
                if value and math.isfinite(x) and math.isfinite(y):
                    entries.append({
                        "t": value[:240],
                        "n": normalize(value)[:240],
                        "x": round(x, 4),
                        "y": round(y, 4),
                    })
            except Exception:
                pass
except Exception:
    pass

# Remove exact duplicate records while preserving order.
seen = set()
unique = []
for item in entries:
    key = (item["t"], item["x"], item["y"])
    if key in seen:
        continue
    seen.add(key)
    unique.append(item)

# Render the drawing and, critically, capture the exact coordinate limits
# that the renderer actually used. Using raw bbox.extents here can be wrong
# for DXF drawings with paperspace/block/display extents, which would shift
# search markers away from the real text.
dpi = 120
target_width_px = 6000
ratio = (ymax - ymin) / max(xmax - xmin, 1e-9)
fig_w = target_width_px / dpi
fig_h = max(1.0, fig_w * ratio)

fig = plt.figure(dpi=dpi, figsize=(fig_w, fig_h))
ax = fig.add_axes((0, 0, 1, 1))
ctx = RenderContext(doc)
layout_properties = LayoutProperties.from_layout(msp)
layout_properties.set_colors("#05080b", "#ffffff")
backend = MatplotlibBackend(ax)
Frontend(ctx, backend, Configuration()).draw_layout(
    msp,
    finalize=True,
    layout_properties=layout_properties,
)

# MatplotlibBackend/Frontend has now established the exact visible world
# coordinate window. Store it so browser markers use precisely the same
# transform as the rendered pixels.
render_xmin, render_xmax = ax.get_xlim()
render_ymin, render_ymax = ax.get_ylim()

fig.savefig(
    SEARCH_IMAGE,
    dpi=dpi,
    facecolor=ax.get_facecolor(),
    transparent=False,
    pil_kwargs={"quality": 95, "optimize": True},
)
plt.close(fig)

img = Image.open(SEARCH_IMAGE).convert("RGB")
if img.width > target_width_px:
    h = round(img.height * target_width_px / img.width)
    img = img.resize((target_width_px, h), Image.Resampling.LANCZOS)
img.save(SEARCH_IMAGE, "JPEG", quality=92, optimize=True, progressive=True)

meta = {
    "version": 2,
    "format": "JPEG + renderer coordinate overlay",
    "source": "cad/FINAL DISPATCH - UPDATE.dwg",
    "image": "data/feeders/drawing-search.jpg",
    "width": img.width,
    "height": img.height,
    "extents": {
        "xmin": float(render_xmin),
        "ymin": float(render_ymin),
        "xmax": float(render_xmax),
        "ymax": float(render_ymax),
    },
    "entries": unique,
}

SEARCH_INDEX.write_text(
    json.dumps(meta, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)

print(f"Search image: {img.width}x{img.height}, {SEARCH_IMAGE.stat().st_size} bytes")
print(f"Search entries: {len(unique)}")
print(f"Extents: {xmin}, {ymin} -> {xmax}, {ymax}")
