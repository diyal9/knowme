#!/usr/bin/env python3
"""
KnowMe app icon — pseudo-3D knowledge graph (K/M bone structure).

Programmatic geometry via Pillow + 8× supersampling for crisp edges at any size.

Usage:
  python scripts/build-icon-graph3d.py          # preview board
  python scripts/build-icon-graph3d.py --ship   # ship to src/assets (after review)
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "assets" / "brand-src" / "preview"
ASSETS = ROOT / "src" / "assets"

# Brand palette
IVORY = (244, 239, 231, 255)
NAVY = (23, 37, 53, 255)
SLATE = (58, 80, 104, 255)
CORAL = (214, 106, 94, 255)

BASE = 1024
BG_RADIUS = 240
SS = 8

# Graph centre + scale — enlarged to ~82% tile fill
GRAPH_C = (515.0, 512.0)
GRAPH_SCALE = 1.68
NODE_R = 62

# K/M skeleton (from build-icon-refine.py mono concept)
K_STEM_T = (240, 300)
K_STEM_B = (240, 724)
K_VTX = (240, 512)
K_UP = (410, 300)
K_DN = (410, 724)
M_L_T = (560, 300)
M_L_B = (560, 724)
M_V = (660, 500)
M_R_T = (790, 300)
M_R_B = (790, 724)

EDGES = [
    (K_STEM_T, K_VTX),
    (K_VTX, K_STEM_B),
    (K_VTX, K_UP),
    (K_VTX, K_DN),
    (K_UP, M_L_T),  # bridge K → M at top rail
    (M_L_T, M_L_B),
    (M_L_T, M_V),
    (M_V, M_R_T),
    (M_R_T, M_R_B),
]

NODES: list[tuple[tuple[float, float], tuple[int, int, int, int], float]] = [
    (K_STEM_T, CORAL, NODE_R + 6),   # focal — slightly larger
    (K_VTX, NAVY, NODE_R),
    (K_STEM_B, SLATE, NODE_R),
    (K_UP, SLATE, NODE_R),
    (K_DN, NAVY, NODE_R),
    (M_L_T, NAVY, NODE_R),
    (M_L_B, SLATE, NODE_R),
    (M_V, SLATE, NODE_R),
    (M_R_T, NAVY, NODE_R),
    (M_R_B, SLATE, NODE_R),
]

EDGE_W = 44
LIGHT = (-0.55, -0.55, 0.62)  # top-left, normalized-ish


def _norm(v: tuple[float, float, float]) -> tuple[float, float, float]:
    m = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1.0
    return (v[0] / m, v[1] / m, v[2] / m)


LIGHT_N = _norm(LIGHT)


def _pt(p: tuple[float, float], ss: int) -> tuple[float, float]:
    x = 512 + (p[0] - GRAPH_C[0]) * GRAPH_SCALE
    y = 512 + (p[1] - GRAPH_C[1]) * GRAPH_SCALE
    return (x * ss, y * ss)


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _shade(base: tuple[int, int, int, int], lit: float) -> tuple[int, int, int, int]:
    """Map lighting 0..1 to shaded RGBA."""
    r, g, b, a = base
    # highlight toward warm ivory tint; shadow toward near-black navy
    hi = (min(255, r + 105), min(255, g + 100), min(255, b + 94))
    lo = (max(0, r - 48), max(0, g - 40), max(0, b - 34))
    if lit > 0.55:
        t = (lit - 0.55) / 0.45
        return (_lerp(r, hi[0], t), _lerp(g, hi[1], t), _lerp(b, hi[2], t), a)
    t = lit / 0.55
    return (_lerp(lo[0], r, t), _lerp(lo[1], g, t), _lerp(lo[2], b, t), a)


def _sphere_sprite(radius: float, base: tuple[int, int, int, int], ss: int) -> Image.Image:
    """Render one lit sphere with radial 3D shading."""
    r = radius * ss
    pad = int(r * 0.35) + 2
    size = int(r * 2) + pad * 2
    cx = cy = size / 2.0
    px = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    raw = px.load()
    r2 = r * r
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            d2 = dx * dx + dy * dy
            if d2 > r2:
                continue
            dz = math.sqrt(r2 - d2)
            nx, ny, nz = dx / r, dy / r, dz / r
            lit = max(0.0, min(1.0, nx * LIGHT_N[0] + ny * LIGHT_N[1] + nz * LIGHT_N[2]))
            # specular bump top-left
            spec = max(0.0, 1.0 - math.hypot(dx + r * 0.38, dy + r * 0.38) / (r * 0.55))
            spec = spec ** 3 * 0.55
            lit = min(1.0, lit + spec)
            raw[x, y] = _shade(base, lit)
    return px


def _drop_shadow(radius: float, ss: int, alpha: int = 52) -> Image.Image:
    r = radius * ss
    pad = int(r * 0.5)
    w, h = int(r * 2.6), int(r * 1.1)
    sh = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse((pad, pad + r * 0.15, pad + w, pad + h + r * 0.15), fill=(0, 0, 0, alpha))
    return sh.filter(ImageFilter.GaussianBlur(radius=max(2, int(r * 0.22))))


def _edge_color(dark: bool = True) -> tuple[int, int, int, int]:
    c = NAVY if dark else SLATE
    return (max(0, c[0] - 6), max(0, c[1] - 4), max(0, c[2] - 2), 255)


def _draw_cylinder(
    layer: Image.Image,
    a: tuple[float, float],
    b: tuple[float, float],
    ss: int,
    width: float,
) -> None:
    """Thick rod with cylindrical highlight — drawn below spheres."""
    draw = ImageDraw.Draw(layer)
    ax, ay = _pt(a, ss)
    bx, by = _pt(b, ss)
    w = max(2, int(width * GRAPH_SCALE * ss))
    hw = w / 2.0
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / length, dx / length

    body = _edge_color(True)
    draw.line([(ax, ay), (bx, by)], fill=body, width=w)

    # highlight stripe offset toward light (top-left)
    hl_w = max(1, w // 4)
    off = hw * 0.28
    lx0, ly0 = ax + nx * off - dy / length * 0, ay + ny * off + dx / length * 0
    lx1, ly1 = bx + nx * off, by + ny * off
    hi = (
        min(255, SLATE[0] + 38),
        min(255, SLATE[1] + 34),
        min(255, SLATE[2] + 30),
        140,
    )
    draw.line([(lx0, ly0), (lx1, ly1)], fill=hi, width=hl_w)


def _tile_canvas(ss: int) -> tuple[Image.Image, Image.Image]:
    size = BASE * ss
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(canvas)
    md = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=BG_RADIUS * ss, fill=IVORY)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=BG_RADIUS * ss, fill=255)
    # subtle top-edge highlight on tile
    rim = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rd.rounded_rectangle(
        (ss, ss, size - ss * 2, size - ss * 2),
        radius=BG_RADIUS * ss - ss,
        outline=(255, 255, 255, 28),
        width=max(1, ss),
    )
    canvas.alpha_composite(rim)
    return canvas, mask


def render_graph3d(ss: int = SS) -> Image.Image:
    size = BASE * ss
    canvas, mask = _tile_canvas(ss)
    graph = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # 1) edge shadows (very soft)
    edge_sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    esd = ImageDraw.Draw(edge_sh)
    for a, b in EDGES:
        ax, ay = _pt(a, ss)
        bx, by = _pt(b, ss)
        esd.line([(ax, ay + 6 * ss), (bx, by + 6 * ss)], fill=(0, 0, 0, 28), width=int(EDGE_W * GRAPH_SCALE * ss))
    edge_sh = edge_sh.filter(ImageFilter.GaussianBlur(radius=4 * ss))
    graph.alpha_composite(edge_sh)

    # 2) cylinders (under nodes)
    for a, b in EDGES:
        _draw_cylinder(graph, a, b, ss, EDGE_W)

    # 3) node drop shadows
    for pos, _color, radius in NODES:
        cx, cy = _pt(pos, ss)
        sh = _drop_shadow(radius, ss)
        sx = int(cx - sh.width / 2 + radius * ss * 0.08)
        sy = int(cy - sh.height / 2 + radius * ss * 0.42)
        graph.alpha_composite(sh, (sx, sy))

    # 4) spheres (on top)
    for pos, color, radius in NODES:
        cx, cy = _pt(pos, ss)
        sp = _sphere_sprite(radius, color, ss)
        ox = int(cx - sp.width / 2)
        oy = int(cy - sp.height / 2)
        graph.alpha_composite(sp, (ox, oy))

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(graph, (0, 0), mask)
    canvas.alpha_composite(clipped)
    return canvas.resize((BASE, BASE), Image.LANCZOS)


def preview_board() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    icon = render_graph3d()

    pad = 32
    strip_h = 88
    board_w = BASE + pad * 2
    board_h = BASE + pad * 2 + strip_h + pad
    board = Image.new("RGBA", (board_w, board_h), (233, 230, 224, 255))
    board.alpha_composite(icon, (pad, pad))

    strip = Image.new("RGBA", (BASE, strip_h), (28, 28, 30, 255))
    bx = 20
    for s in (64, 48, 32, 16):
        thumb = icon.resize((s, s), Image.LANCZOS)
        strip.alpha_composite(thumb, (bx, (strip_h - s) // 2))
        bx += s + 22

    board.alpha_composite(strip, (pad, pad + BASE + pad))
    out = PREVIEW / "graph3d-board.png"
    board.save(out)
    print("wrote", out)


def ship() -> None:
    """Ship production assets — run only after visual review."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    icon = render_graph3d(ss=SS)
    icon.save(ASSETS / "icon.png")
    icon.save(
        ASSETS / "icon.ico",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)],
    )
    icon.resize((256, 256), Image.LANCZOS).save(ASSETS / "tray-icon.png")
    print("shipped graph3d icon to", ASSETS)


if __name__ == "__main__":
    if "--ship" in sys.argv:
        ship()
    else:
        preview_board()
