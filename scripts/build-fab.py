#!/usr/bin/env python3
"""
KnowMe FAB — "breathing knowledge node" floating action button mark.

  primary  : coral fill, ivory 3-node spark
  inverted : navy fill, ivory connectors + satellites, coral center (light desktops)
  thinking : primary + ivory pulse rings

Usage:
  python scripts/build-fab.py          # preview board
  python scripts/build-fab.py --ship   # ship variant A to src/assets/assistant-fab.png
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "assets" / "brand-src" / "preview"
ASSETS = ROOT / "src" / "assets"

IVORY = (244, 239, 231, 255)
NAVY = (23, 37, 53, 255)
# softer terracotta coral — desaturated so the FAB reads calm, not neon
CORAL = (214, 106, 94, 255)

BASE = 1024
SS = 8
CX, CY = 512, 512
CIRCLE_R = 500
CENTER_NODE = (512, 512)
CENTER_R = 112
SAT1 = (702, 322)
SAT2 = (322, 702)
SAT_R = 66
CONN_W = 46
PULSE_INNER_R = 300
PULSE_INNER_W = 26
PULSE_INNER_A = 90
PULSE_OUTER_R = 384
PULSE_OUTER_W = 16
PULSE_OUTER_A = 50


def _alpha(color: tuple, a: int) -> tuple:
    return (color[0], color[1], color[2], a)


def _draw_spark(
    draw: ImageDraw.ImageDraw,
    ss: int,
    *,
    conn_color: tuple,
    center_color: tuple,
    sat_color: tuple,
) -> None:
    lw = int(CONN_W * ss)
    for sat in (SAT1, SAT2):
        draw.line(
            [(CX * ss, CY * ss), (sat[0] * ss, sat[1] * ss)],
            fill=conn_color,
            width=lw,
        )
    for center, radius, fill in (
        (CENTER_NODE, CENTER_R, center_color),
        (SAT1, SAT_R, sat_color),
        (SAT2, SAT_R, sat_color),
    ):
        cx, cy = center[0] * ss, center[1] * ss
        rr = radius * ss
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=fill)


def _draw_pulse_rings(draw: ImageDraw.ImageDraw, ss: int, color: tuple) -> None:
    cx, cy = CX * ss, CY * ss
    for radius, width, alpha in (
        (PULSE_INNER_R, PULSE_INNER_W, PULSE_INNER_A),
        (PULSE_OUTER_R, PULSE_OUTER_W, PULSE_OUTER_A),
    ):
        rr = radius * ss
        sw = int(width * ss)
        draw.ellipse(
            (cx - rr, cy - rr, cx + rr, cy + rr),
            outline=_alpha(color, alpha),
            width=sw,
        )


def render_fab(
    variant: str = "primary",
    ss: int = SS,
) -> Image.Image:
    """Render one FAB variant at BASE×BASE (supersampled then downscaled)."""
    size = BASE * ss
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    cr = CIRCLE_R * ss
    if variant == "primary":
        fill = CORAL
        conn, center, sat = IVORY, IVORY, IVORY
        pulse = False
    elif variant == "inverted":
        fill = NAVY
        conn, center, sat = IVORY, CORAL, IVORY
        pulse = False
    elif variant == "thinking":
        fill = CORAL
        conn, center, sat = IVORY, IVORY, IVORY
        pulse = True
    else:
        raise ValueError(f"unknown variant: {variant}")

    d.ellipse(
        (CX * ss - cr, CY * ss - cr, CX * ss + cr, CY * ss + cr),
        fill=fill,
    )

    if pulse:
        _draw_pulse_rings(d, ss, IVORY)

    _draw_spark(d, ss, conn_color=conn, center_color=center, sat_color=sat)

    return canvas.resize((BASE, BASE), Image.LANCZOS)


def _label(img: Image.Image, text: str, x: int, y: int, width: int) -> None:
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((x + (width - tw) // 2, y), text, fill=(80, 76, 72, 255), font=font)


def preview() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)

    variants = {
        "primary": render_fab("primary"),
        "inverted": render_fab("inverted"),
        "thinking": render_fab("thinking"),
    }

    card_bg = (233, 230, 224, 255)
    tile = 300
    pad = 36
    label_h = 28
    top_h = tile + label_h + pad

    board_w = pad * 2 + tile * 3 + pad * 2
    strip_h = 72
    strip_pad = 24
    bottom_h = strip_pad + strip_h + strip_pad + strip_h + strip_pad
    board_h = top_h + bottom_h

    board = Image.new("RGBA", (board_w, board_h), card_bg)

    labels = ("A primary", "B inverted", "C thinking")
    for i, (key, label) in enumerate(zip(variants, labels)):
        x = pad + i * (tile + pad)
        card = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
        fab = variants[key].resize((tile, tile), Image.LANCZOS)
        card.alpha_composite(fab)
        board.alpha_composite(card, (x, pad))
        _label(board, label, x, pad + tile + 6, tile)

    light_bg = (238, 236, 232, 255)
    dark_bg = (28, 28, 30, 255)
    sizes = (56, 40, 24)

    def _strip(bg: tuple, fab_key: str, y: int) -> None:
        strip = Image.new("RGBA", (board_w - pad * 2, strip_h), bg)
        bx = 16
        for s in sizes:
            icon = variants[fab_key].resize((s, s), Image.LANCZOS)
            strip.alpha_composite(icon, (bx, (strip_h - s) // 2))
            bx += s + 20
        board.alpha_composite(strip, (pad, y))

    y0 = top_h
    _strip(light_bg, "primary", y0)
    _strip(dark_bg, "primary", y0 + strip_h + strip_pad)
    _strip(light_bg, "inverted", y0 + 2 * (strip_h + strip_pad))

    out = PREVIEW / "fab-board.png"
    board.save(out)
    print("wrote", out)


def ship() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    fab = render_fab("primary")
    fab.resize((512, 512), Image.LANCZOS).save(ASSETS / "assistant-fab.png")
    print("shipped primary FAB to", ASSETS / "assistant-fab.png")


if __name__ == "__main__":
    if "--ship" in sys.argv:
        ship()
    else:
        preview()
