#!/usr/bin/env python3
"""
Build the approved KnowMe connected application mark.

The production mark is one navy rounded carrier, one ivory five-node path, and
one coral origin — same brand as always. The connected graph is scaled up about
the plate center so it reads fuller and sharper on Windows taskbar / tray sizes.
Every raster output is rendered directly from normalized geometry so native
Windows frames do not depend on downscaling the 1024 px master.

Usage:
  python scripts/build-icon-refine.py --ship          # ship all app icon assets
  python scripts/build-icon-refine.py --taskbar-fill  # dark-taskbar strip preview
  python scripts/build-icon-refine.py                  # legacy comparison board
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "assets" / "brand-src" / "preview"
ASSETS = ROOT / "src" / "assets"

IVORY = (244, 239, 231, 255)
NAVY = (23, 37, 53, 255)
NAVY_BACK = (58, 80, 104, 255)   # lighter slate — back card layer
CORAL = (240, 93, 78, 255)

BASE = 1024
BG_RADIUS = 240

# =============================================================== mono concept
MONO_C = (515, 512)
MONO_SCALE = 1.0
W = 78
NODE_R = 54

# K
K_STEM_T = (240, 300)
K_STEM_B = (240, 724)
K_VTX = (240, 512)
K_UP = (410, 300)
K_DN = (410, 724)
# M
M_L_T = (560, 300)
M_L_B = (560, 724)
M_V = (660, 500)
M_R_T = (790, 300)
M_R_B = (790, 724)

MONO_CORAL_JOINT = M_V   # coral focal node at the M valley


def _m(pt, ss, dx, dy, scale=MONO_SCALE):
    x = 512 + (pt[0] - MONO_C[0]) * scale + dx
    y = 512 + (pt[1] - MONO_C[1]) * scale + dy
    return (x * ss, y * ss)


def paint_mono(draw, ss, navy, coral, dx=0.0, dy=0.0, scale=MONO_SCALE, beads=True,
               stroke_w=None):
    lw = int((stroke_w if stroke_w is not None else W) * scale * ss)

    def seg(a, b):
        draw.line([_m(a, ss, dx, dy, scale), _m(b, ss, dx, dy, scale)], fill=navy, width=lw)

    def poly(pts):
        draw.line([_m(p, ss, dx, dy, scale) for p in pts], fill=navy, width=lw, joint="curve")

    def node(c, r, fill):
        cx, cy = _m(c, ss, dx, dy, scale)
        rr = r * scale * ss
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=fill)

    # strokes
    seg(K_STEM_T, K_STEM_B)
    seg(K_VTX, K_UP)
    seg(K_VTX, K_DN)
    seg(M_L_T, M_L_B)
    poly([M_L_T, M_V, M_R_T])
    seg(M_R_T, M_R_B)
    # node beads on terminals + joints (graph flavour) — dropped at small sizes
    if beads:
        for b in [K_STEM_T, K_STEM_B, K_VTX, K_UP, K_DN, M_L_T, M_L_B, M_R_T, M_R_B]:
            node(b, NODE_R, navy)
        if coral is not None:
            node(MONO_CORAL_JOINT, NODE_R + 4, coral)
        else:
            node(MONO_CORAL_JOINT, NODE_R, navy)
    elif coral is not None:
        # keep a single coral accent even without the full bead set
        node(MONO_CORAL_JOINT, NODE_R, coral)


# =============================================================== note concept
def paint_note(draw, ss, navy, ivory, coral, navy_back=NAVY_BACK, gap=IVORY,
               dx=0.0, dy=0.0, scale=1.0, cx0=512, cy0=512, beads=True, kw=58):
    # scale the whole composition (bubble + back card + KM) about (cx0, cy0);
    # defaults are identity so existing renders are unchanged.
    S = scale

    def TX(x):
        return (512 + (x - cx0) * S + dx) * ss

    def TY(y):
        return (512 + (y - cy0) * S + dy) * ss

    def RR(x0, y0, x1, y1, rad, fill):
        draw.rounded_rectangle((TX(x0), TY(y0), TX(x1), TY(y1)), radius=rad * S * ss, fill=fill)

    def line(pts, w, fill):
        draw.line([(TX(x), TY(y)) for x, y in pts], fill=fill, width=int(w * S * ss),
                  joint="curve")

    def dot(c, r, fill):
        cx, cy = TX(c[0]), TY(c[1])
        rr = r * S * ss
        draw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=fill)

    def tri(pts, fill):
        draw.polygon([(TX(x), TY(y)) for x, y in pts], fill=fill)

    G = 20  # ivory moat that separates the two layers
    # back card (lighter slate → clear layer separation)
    RR(388, 300, 786, 716, 74, navy_back)
    # ivory moat around the front card so the seam reads
    RR(220 - G, 236 - G, 700 + G, 664 + G, 84 + G, gap)
    tri([(242 - G, 596 - G), (242 - G, 742 + G), (372 + G, 628), (360, 620 - G)], gap)
    # front speech card
    RR(220, 236, 700, 664, 84, navy)
    tri([(242, 596), (242, 742), (360, 628)], navy)

    # KM in knowledge-graph style: ivory strokes + node beads (concept 1 look).
    # beads=True keeps the graph look at large sizes; beads=False gives a bolder,
    # bead-free KM with flush round caps so it stays crisp at tiny sizes.
    node_r = 40
    # K
    ks = 310
    k_top, k_bot, k_vtx = (ks, 318), (ks, 602), (ks, 460)
    k_up, k_dn = (415, 318), (415, 602)
    line([k_top, k_bot], kw, ivory)
    line([k_vtx, k_up], kw, ivory)
    line([k_vtx, k_dn], kw, ivory)
    # M
    ml, mr = 475, 645
    m_lt, m_lb = (ml, 318), (ml, 602)
    m_rt, m_rb = (mr, 318), (mr, 602)
    m_v = ((ml + mr) / 2, 505)
    line([m_lt, m_lb], kw, ivory)
    line([m_lt, m_v, m_rt], kw, ivory)
    line([m_rt, m_rb], kw, ivory)
    if beads:
        # bulged node beads on terminals / joints (graph flavour)
        for b in [k_bot, k_vtx, k_up, k_dn, m_lt, m_lb, m_v, m_rt, m_rb]:
            dot(b, node_r, ivory)
        dot(k_top, node_r + 6, coral)   # coral focal node at K top-left terminal
    else:
        # flush round caps only — no bumps; bolder strokes carry small sizes
        rcap = kw / 2
        for b in (k_top, k_bot, k_up, k_dn, m_lt, m_lb, m_rt, m_rb):
            dot(b, rcap, ivory)
        dot(k_top, rcap + 8, coral)     # single coral accent, subtle


# ================================================================== rendering
def _tile(ss, bg, circle=False):
    size = BASE * ss
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    if circle:
        r = size / 2 - ss
        d.ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r), fill=bg)
        md.ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r), fill=255)
    else:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=BG_RADIUS * ss, fill=bg)
        md.rounded_rectangle((0, 0, size - 1, size - 1), radius=BG_RADIUS * ss, fill=255)
    return img, mask


def render_mono(ss=6, shadow=True, bg=IVORY, navy=NAVY, coral=CORAL, circle=False):
    size = BASE * ss
    canvas, mask = _tile(ss, bg, circle)
    if shadow:
        sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        paint_mono(ImageDraw.Draw(sh), ss, (0, 0, 0, 100), (0, 0, 0, 100), dy=16)
        sh = sh.filter(ImageFilter.GaussianBlur(radius=12 * ss))
        clip = Image.new("RGBA", (size, size), (0, 0, 0, 0)); clip.paste(sh, (0, 0), mask)
        canvas.alpha_composite(clip)
    mark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paint_mono(ImageDraw.Draw(mark), ss, navy, coral)
    clip = Image.new("RGBA", (size, size), (0, 0, 0, 0)); clip.paste(mark, (0, 0), mask)
    canvas.alpha_composite(clip)
    return canvas.resize((BASE, BASE), Image.LANCZOS)


def render_note(ss=6, shadow=False, bg=IVORY, navy=NAVY, ivory=IVORY, coral=CORAL, circle=False):
    size = BASE * ss
    canvas, mask = _tile(ss, bg, circle)
    mark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paint_note(ImageDraw.Draw(mark), ss, navy, ivory, coral)
    clip = Image.new("RGBA", (size, size), (0, 0, 0, 0)); clip.paste(mark, (0, 0), mask)
    canvas.alpha_composite(clip)
    return canvas.resize((BASE, BASE), Image.LANCZOS)


def board():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    m = render_mono()
    n = render_note()
    bd = Image.new("RGBA", (900, 640), (233, 230, 224, 255))
    bd.alpha_composite(m.resize((380, 380), Image.LANCZOS), (30, 30))
    bd.alpha_composite(n.resize((380, 380), Image.LANCZOS), (450, 30))
    bar = Image.new("RGBA", (840, 100), (28, 28, 30, 255))
    bx = 24
    for im in (m, n):
        for s in (64, 48, 32, 16):
            bar.alpha_composite(im.resize((s, s), Image.LANCZOS), (bx, (100 - s) // 2))
            bx += s + 18
        bx += 40
    bd.alpha_composite(bar, (30, 450))
    bd.save(PREVIEW / "refine-board.png")
    print("wrote", PREVIEW / "refine-board.png")


# composition center + fill scale so the whole speech-bubble group fills the tile
NOTE_FILL_C = (493, 479)
NOTE_SHIP_SCALE = 1.5


def render_note_fill(ss=6, scale=1.5, bg=IVORY, navy=NAVY, ivory=IVORY, coral=CORAL,
                     beads=True, kw=58):
    """Whole speech-bubble composition scaled up to fill the tile.
    beads=False + bigger kw yields the crisp small-size lockup (same bubble)."""
    size = BASE * ss
    canvas, mask = _tile(ss, bg, circle=False)
    mark = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paint_note(ImageDraw.Draw(mark), ss, navy, ivory, coral,
               scale=scale, cx0=NOTE_FILL_C[0], cy0=NOTE_FILL_C[1], beads=beads, kw=kw)
    clip = Image.new("RGBA", (size, size), (0, 0, 0, 0)); clip.paste(mark, (0, 0), mask)
    canvas.alpha_composite(clip)
    return canvas.resize((BASE, BASE), Image.LANCZOS)


# small-size lockup: preserve the double-layer speech bubble, but simplify the
# KM nodes and strengthen its strokes so the shared brand mark survives at 16px.
NOTE_SMALL_SCALE = 1.64
NOTE_SMALL_STROKE = 90
WINDOWS_SMALL_SAFE_AREA = 0.0625


def render_small_px(size):
    """Render the unified speech-bubble brand mark at an exact pixel size."""
    ss = max(8, min(16, size * 2))
    src = render_note_fill(
        ss=ss,
        scale=NOTE_SMALL_SCALE,
        beads=False,
        kw=NOTE_SMALL_STROKE,
    )
    return src.resize((size, size), Image.LANCZOS)


def render_windows_small_px(size):
    """Center the unified brand mark inside the Windows native-icon safe area."""
    inset = max(1, round(size * WINDOWS_SMALL_SAFE_AREA))
    inner_size = size - inset * 2
    mark = render_small_px(inner_size)
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    frame.alpha_composite(mark, (inset, inset))
    return frame


def render_old_small_px(size):
    """Previous divergent treatment: a navy tile with an isolated KM mark."""
    ss = max(8, min(16, size * 2))
    src = render_mono(ss=ss, shadow=False, bg=NAVY, navy=IVORY)
    return src.resize((size, size), Image.LANCZOS)


def small_board():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    big = render_note_fill(scale=NOTE_SHIP_SCALE)
    small = render_note_fill(scale=NOTE_SHIP_SCALE, beads=False, kw=78)
    bd = Image.new("RGBA", (900, 360), (233, 230, 224, 255))
    bd.alpha_composite(big.resize((300, 300), Image.LANCZOS), (20, 20))
    bd.alpha_composite(small.resize((300, 300), Image.LANCZOS), (340, 20))
    # taskbar-sim strips: full art vs simplified, on dark + light
    for bg_col, y in (((44, 46, 50, 255), 20), ((236, 236, 238, 255), 120)):
        strip = Image.new("RGBA", (240, 88), bg_col)
        bx = 12
        for s in (48, 32, 24, 16):
            strip.alpha_composite(big.resize((s, s), Image.LANCZOS), (bx, (88 - s) // 2))
            bx += s + 8
        bd.alpha_composite(strip, (660, y))
    for bg_col, y in (((44, 46, 50, 255), 220), ((236, 236, 238, 255), 280)):
        strip = Image.new("RGBA", (240, 56), bg_col)
        bx = 12
        for s in (48, 32, 24, 16):
            strip.alpha_composite(small.resize((s, s), Image.LANCZOS), (bx, (56 - s) // 2))
            bx += s + 8
        bd.alpha_composite(strip, (660, y))
    bd.save(PREVIEW / "small-board.png")
    print("wrote", PREVIEW / "small-board.png")


def fill_board():
    PREVIEW.mkdir(parents=True, exist_ok=True)
    a = render_note_fill(scale=1.42)   # 稳妥填充
    b = render_note_fill(scale=1.58)   # 更满
    bd = Image.new("RGBA", (900, 640), (233, 230, 224, 255))
    bd.alpha_composite(a.resize((380, 380), Image.LANCZOS), (30, 30))
    bd.alpha_composite(b.resize((380, 380), Image.LANCZOS), (450, 30))
    bar = Image.new("RGBA", (840, 100), (60, 60, 62, 255))
    bx = 24
    for im in (a, b):
        for s in (64, 48, 32, 16):
            bar.alpha_composite(im.resize((s, s), Image.LANCZOS), (bx, (100 - s) // 2))
            bx += s + 18
        bx += 40
    bd.alpha_composite(bar, (30, 450))
    bd.save(PREVIEW / "fill-board.png")
    print("wrote", PREVIEW / "fill-board.png")


def taskbar_clarity_board():
    """Before/after comparison on dark taskbar: old ivory-bubble vs new navy+KM."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sizes = (16, 24, 32, 48)
    zoom = 8
    pad = 24
    label_h = 28
    row_h = max(s * zoom for s in sizes) + pad * 2
    col_w = sum(s * zoom for s in sizes) + pad * (len(sizes) + 1)
    W = col_w + pad * 2
    H = label_h + row_h * 2 + pad * 3

    bd = Image.new("RGBA", (W, H), (28, 28, 30, 255))
    d = ImageDraw.Draw(bd)
    d.text((pad, 6), "OLD (isolated KM lockup)", fill=(180, 180, 185, 255))
    d.text((pad, label_h + row_h + pad + 6), "NEW (unified speech-bubble mark)",
           fill=(180, 180, 185, 255))

    def _row(y0, renderer):
        bx = pad
        for s in sizes:
            px = s * zoom
            cell = Image.new("RGBA", (px, px), (0, 0, 0, 0))
            icon = renderer(s)
            cell.alpha_composite(icon.resize((px, px), Image.NEAREST))
            # faint pixel grid
            gd = ImageDraw.Draw(cell)
            for g in range(0, px, zoom):
                gd.line([(g, 0), (g, px)], fill=(255, 255, 255, 18))
                gd.line([(0, g), (px, g)], fill=(255, 255, 255, 18))
            bd.alpha_composite(cell, (bx, y0 + (row_h - px) // 2))
            d.text((bx, y0 + row_h - 18), f"{s}px", fill=(140, 140, 145, 255))
            bx += px + pad

    _row(label_h, render_old_small_px)
    _row(label_h + row_h + pad, render_windows_small_px)
    out = PREVIEW / "taskbar-clarity-board.png"
    bd.save(out)
    print("wrote", out)


# ========================================================= connected production
# Original brand palette (navy plate / ivory path / coral origin). The five-node
# graph is scaled about the plate center so the mark fills the slot better on
# Windows taskbar — no recolor or redesign.
CONNECTED_INSET = 24 / BASE
CONNECTED_RADIUS = 196 / BASE
CONNECTED_MARK_SCALE = 1.42
CONNECTED_LINE_WIDTH = 68 / BASE
CONNECTED_CARRIER = NAVY
CONNECTED_PATH = IVORY
CONNECTED_ORIGIN = CORAL
# Pre-scale base geometry (legacy approved coords at scale 1.0).
_CONNECTED_BASE_POINTS = {
    "origin": (273 / BASE, 285 / BASE),
    "left": (273 / BASE, 718 / BASE),
    "center": (545 / BASE, 509 / BASE),
    "upper_right": (750 / BASE, 279 / BASE),
    "lower_right": (750 / BASE, 724 / BASE),
}
_CONNECTED_BASE_RADII = {
    "origin": 53 / BASE,
    "left": 66 / BASE,
    "center": 76 / BASE,
    "upper_right": 66 / BASE,
    "lower_right": 66 / BASE,
}


def _scale_connected(pt):
    cx, cy = 0.5, 0.5
    return (
        cx + (pt[0] - cx) * CONNECTED_MARK_SCALE,
        cy + (pt[1] - cy) * CONNECTED_MARK_SCALE,
    )


CONNECTED_POINTS = {name: _scale_connected(pt) for name, pt in _CONNECTED_BASE_POINTS.items()}
CONNECTED_NODE_RADII = {
    name: r * CONNECTED_MARK_SCALE for name, r in _CONNECTED_BASE_RADII.items()
}


def render_connected_px(size):
    """Render the approved connected mark directly at one native output size."""
    ss = 16 if size <= 64 else 8 if size <= 256 else 4
    work = size * ss
    canvas = Image.new("RGBA", (work, work), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    inset = max(1, int(size * CONNECTED_INSET + 0.5))
    edge = (size - inset) * ss - 1
    draw.rounded_rectangle(
        (inset * ss, inset * ss, edge, edge),
        radius=round(size * CONNECTED_RADIUS * ss),
        fill=CONNECTED_CARRIER,
    )

    def point(name):
        x, y = CONNECTED_POINTS[name]
        return (round(x * size * ss), round(y * size * ss))

    line_width = max(1.5, size * CONNECTED_LINE_WIDTH)
    width = round(line_width * ss)
    draw.line(
        [point("origin"), point("left"), point("center")],
        fill=CONNECTED_PATH,
        width=width,
        joint="curve",
    )
    draw.line(
        [point("center"), point("upper_right")],
        fill=CONNECTED_PATH,
        width=width,
    )
    draw.line(
        [point("center"), point("lower_right")],
        fill=CONNECTED_PATH,
        width=width,
    )

    def node(name, color):
        cx, cy = point(name)
        radius = max(1.35 if name == "origin" else 1.6, size * CONNECTED_NODE_RADII[name]) * ss
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)

    for name in ("left", "center", "upper_right", "lower_right"):
        node(name, CONNECTED_PATH)
    node("origin", CONNECTED_ORIGIN)
    output = canvas.resize((size, size), Image.Resampling.LANCZOS)
    # LANCZOS can leave sub-pixel alpha outside the intended native safe area.
    # Clear the edge explicitly so Windows never sees clipped artwork.
    edge_draw = ImageDraw.Draw(output)
    edge_draw.rectangle((0, 0, size - 1, inset - 1), fill=(0, 0, 0, 0))
    edge_draw.rectangle((0, size - inset, size - 1, size - 1), fill=(0, 0, 0, 0))
    edge_draw.rectangle((0, 0, inset - 1, size - 1), fill=(0, 0, 0, 0))
    edge_draw.rectangle((size - inset, 0, size - 1, size - 1), fill=(0, 0, 0, 0))
    return output


def ship():
    ASSETS.mkdir(parents=True, exist_ok=True)
    render_connected_px(BASE).save(ASSETS / "icon.png")
    sizes = (256, 128, 64, 48, 32, 24, 16)
    ico = [render_connected_px(size) for size in sizes]
    ico[0].save(ASSETS / "icon.ico", format="ICO", append_images=ico[1:])
    # 32 physical pixels presented as 16 DIP by Electron on Windows.
    render_connected_px(32).save(ASSETS / "tray-icon.png")
    print("shipped connected mark to", ASSETS)


def taskbar_fill_board():
    """Dark-taskbar strip for the scaled original mark."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    strip_h = 96
    sizes = (48, 32, 24, 16)
    bd = Image.new("RGBA", (520, strip_h + 48), (28, 28, 30, 255))
    d = ImageDraw.Draw(bd)
    d.text((16, 10), "navy original mark, scaled fill", fill=(190, 190, 195, 255))
    bx = 24
    for s in sizes:
        icon = render_connected_px(s)
        bd.alpha_composite(icon, (bx, 36 + (strip_h - 36 - s) // 2))
        d.text((bx, strip_h + 20), f"{s}", fill=(140, 140, 145, 255))
        bx += s + 28
    out = PREVIEW / "taskbar-scaled-fill-board.png"
    bd.save(out)
    print("wrote", out)


if __name__ == "__main__":
    if "--ship" in sys.argv:
        ship()
    elif "--taskbar-fill" in sys.argv:
        taskbar_fill_board()
    elif "--clarity" in sys.argv:
        taskbar_clarity_board()
    elif "--fill" in sys.argv:
        fill_board()
    elif "--small" in sys.argv:
        small_board()
    else:
        board()
