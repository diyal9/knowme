#!/usr/bin/env python3
"""
Build KnowMe brand icons from art-directed concept sources.

Sources (committed under assets/brand-src/):
- km-app-icon-concept.png : KM-fused AI robot squircle app icon
- km-fab-concept.png       : circular KM robot floating-assistant badge

Outputs (src/assets/):
- icon.png        : 1024 app icon with transparent rounded corners
- icon.ico        : multi-size Windows icon
- tray-icon.png   : monochrome white robot glyph for small tray rendering
- assistant-fab.png : circular floating-assistant badge (transparent outside)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "brand-src"
ASSETS = ROOT / "src" / "assets"

APP_SRC = SRC / "km-dir-c-note.png"
FAB_SRC = SRC / "km-dir-c-fab.png"

ICON_PNG = ASSETS / "icon.png"
ICON_ICO = ASSETS / "icon.ico"
TRAY_PNG = ASSETS / "tray-icon.png"
FAB_PNG = ASSETS / "assistant-fab.png"

SS = 4  # supersample factor for smooth masks


def bright_bbox(rgb: Image.Image, threshold: int = 120) -> tuple[int, int, int, int]:
    """Bounding box of the bright squircle body (excludes black corners/shadow)."""
    gray = rgb.convert("L").point(lambda v: 255 if v >= threshold else 0)
    box = gray.getbbox()
    return box if box else (0, 0, rgb.width, rgb.height)


def squircle_mask(size: tuple[int, int], radius_ratio: float = 0.235) -> Image.Image:
    w, h = size
    hi = Image.new("L", (w * SS, h * SS), 0)
    d = ImageDraw.Draw(hi)
    r = int(min(w, h) * SS * radius_ratio)
    d.rounded_rectangle((0, 0, w * SS - 1, h * SS - 1), radius=r, fill=255)
    return hi.resize((w, h), Image.LANCZOS)


def build_app_icon() -> Image.Image:
    rgb = Image.open(APP_SRC).convert("RGB")
    left, top, right, bottom = bright_bbox(rgb)
    # Inset slightly so the mask sits just inside the gradient edge (no black sliver).
    inset = int(min(right - left, bottom - top) * 0.012)
    box = (left + inset, top + inset, right - inset, bottom - inset)
    body = rgb.crop(box)

    mask = squircle_mask(body.size)
    out = Image.new("RGBA", body.size, (0, 0, 0, 0))
    out.paste(body, (0, 0), mask)
    return out.resize((1024, 1024), Image.LANCZOS)


def build_tray_icon(app_icon: Image.Image) -> Image.Image:
    """Reuse the full colored mark: the robot on the gradient squircle stays
    recognizable even when the OS renders it at 16px, unlike a hollow glyph."""
    return app_icon.resize((256, 256), Image.LANCZOS)


def build_fab_icon() -> Image.Image:
    rgb = Image.open(FAB_SRC).convert("RGB")
    w, h = rgb.size
    # The badge sits centered; keep a centered disk and drop the dark canvas + glow.
    cx, cy = w / 2, h / 2
    radius = min(w, h) * 0.487

    hi = Image.new("L", (w * SS, h * SS), 0)
    d = ImageDraw.Draw(hi)
    d.ellipse(
        (
            (cx - radius) * SS,
            (cy - radius) * SS,
            (cx + radius) * SS,
            (cy + radius) * SS,
        ),
        fill=255,
    )
    mask = hi.resize((w, h), Image.LANCZOS)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(rgb, (0, 0), mask)
    box = mask.getbbox()
    out = out.crop(box)
    return out.resize((512, 512), Image.LANCZOS)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    app_icon = build_app_icon()
    app_icon.save(ICON_PNG)
    app_icon.save(
        ICON_ICO,
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)],
    )
    build_tray_icon(app_icon).save(TRAY_PNG)
    build_fab_icon().save(FAB_PNG)

    for path in (ICON_PNG, ICON_ICO, TRAY_PNG, FAB_PNG):
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
