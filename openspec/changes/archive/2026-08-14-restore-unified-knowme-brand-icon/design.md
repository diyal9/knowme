## Context

See `proposal.md` for motivation. Producer review replaced the earlier double-layer speech-bubble direction with one approved connected mark. The new artwork uses a transparent canvas, a single navy rounded-square carrier, an ivory five-node path, and one smaller coral origin node. Electron continues to load only committed assets in the main process; the renderer and IPC layers do not participate.

## Goals / Non-Goals

**Goals:**

- Reuse one connected-mark geometry across the master PNG, every ICO frame, and the tray source.
- Preserve transparent rounded corners and at least one native transparent pixel without making the icon visually smaller than neighboring system icons.
- Keep no more than five nodes, avoid crossing paths, and reserve coral for the single origin node.
- Keep generation deterministic and entirely build-time, with no startup CPU or memory increase.

**Non-Goals:**

- No runtime image generation, renderer changes, preload changes, or new IPC.
- No changes to page layout, the floating assistant button, or unrelated capability artwork.

## Decisions

### Replace the layered speech bubble with one connected mark

Render a single navy rounded-square carrier with a non-crossing path: the coral upper-left origin joins a lower-left node, flows into the central hub, then branches to upper-right and lower-right endpoints. The mark uses normalized coordinates so every output is generated from the same geometry.

Alternative considered: retain the speech-bubble tail and rear card. Producer review rejected that treatment because the carrier competed with the connection metaphor and became dense at small sizes.

### Keep explicit small ICO frames

Continue supplying 16/24/32/48 px frames rather than allowing Windows to downscale the 256 px master. Each native frame is rendered from normalized geometry at a high supersampling factor so the carrier radius, line weight, nodes, and one-pixel transparent boundary remain optically stable.

Alternative considered: use only `icon.png`. Electron and Windows frame selection is less predictable and may fall back to a generic icon.

### Use a 32 px 2× tray representation

Generate `tray-icon.png` directly at 32 px and load it into Electron with `scaleFactor: 2`, so it occupies 16 DIP while retaining enough physical pixels for 125%/150% Windows display scaling. This prevents Windows from enlarging a low-resolution 16 px bitmap to 20 or 24 physical pixels.

Alternative considered: use a native 16 px source. The second screenshot at 125% scaling shows that the system enlarges it and exposes blur. A 256 px source is also rejected because excessive runtime reduction softens the same details.

### Preserve the main-process asset boundary

The main process continues to materialize the committed `.ico` at a content-addressed path and load the tray PNG. No renderer or IPC code changes are needed, so startup cost remains a single file read/copy as before.

### Keep the SVG and raster generator in sync

`assets/brand-src/knowme-icon.svg` records the normalized master geometry for design review. `scripts/build-icon-refine.py` reproduces the same geometry with Pillow and is the deterministic source for committed raster assets. Automated tests validate the expected palette and alpha bounds to catch drift.

## Risks / Trade-offs

- [A connected graph can look like a generic share icon] → Keep the asymmetric origin-to-hub-to-branch rhythm and the single coral origin node from the approved artwork.
- [Thin joins can blur at 16 px] → Render every native frame directly with supersampling and enforce minimum line/node proportions.
- [Insufficient safe area can make the carrier feel clipped] → Keep at least one transparent native pixel and test all four edges.
- [Binary assets can drift from the generator] → Regenerate all three assets from the checked-in script and validate them in automated tests.

## Migration Plan

Regenerate `src/assets/icon.png`, `src/assets/icon.ico`, and `src/assets/tray-icon.png`. On restart, the existing content-addressed icon path changes with the ICO bytes, forcing Windows to load the new frames. Rollback restores the previous generator revision and regenerates all three assets.
