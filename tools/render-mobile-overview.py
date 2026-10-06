#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import ezdxf
from ezdxf.addons.drawing import matplotlib

DXF = Path("/tmp/final-dispatch.dxf")
OUT = Path("data/feeders/mobile-overview.jpg")
OUT.parent.mkdir(parents=True, exist_ok=True)

doc = ezdxf.readfile(DXF)
matplotlib.qsave(
    doc,
    str(OUT),
    layout="Model",
    dpi=96,
    size_inches=(18, 12),
    bg="#05080b",
    fg="#ffffff",
)

img = Image.open(OUT).convert("RGB")
max_w = 2400
if img.width > max_w:
    h = round(img.height * max_w / img.width)
    img = img.resize((max_w, h), Image.Resampling.LANCZOS)
img.save(OUT, "JPEG", quality=82, optimize=True, progressive=True)
print(f"Created {OUT}: {img.width}x{img.height}, {OUT.stat().st_size} bytes")
