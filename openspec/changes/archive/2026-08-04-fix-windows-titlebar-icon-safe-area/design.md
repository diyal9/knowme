## Context

See `proposal.md` for motivation. Electron's main process copies the committed multi-size `src/assets/icon.ico` to a fixed `%APPDATA%\KnowMe\app-icon.ico` path and passes it to every Windows `BrowserWindow`; the renderer and IPC layers do not participate. The fixed path lets the Windows shell retain an older taskbar bitmap even after the file content is overwritten.

## Goals / Non-Goals

**Goals:**
- Generate deterministic, centered safe-area variants for the four Windows small icon frames.
- Force Windows to resolve updated icon content after an application restart without clearing the global shell icon cache.
- Make the safe area machine-verifiable without loading Electron.
- Preserve startup performance and memory by continuing to load one committed `.ico`.

**Non-Goals:**
- No renderer CSS, preload, IPC, or BrowserWindow sizing changes.
- No runtime icon generation.
- No changes to 64/128/256 px frames or `icon.png`.

## Decisions

### Add padding during small-frame generation

Render the existing high-contrast KM lockup at each target size, scale it to 75% of the frame, and center it on a transparent canvas. This produces a 12.5% safe area on every edge.

Alternative considered: resize the icon in the Electron main process. Windows chooses a frame from `.ico` after Electron passes the resource, so runtime resizing cannot reliably control the native title-bar representation.

### Keep large frames unchanged

Only 16/24/32/48 px frames receive padding. Large app surfaces benefit from the existing full-tile composition and are not implicated in the title-bar issue.

Alternative considered: pad the master `icon.png`. That would shrink the brand mark on every platform and surface, expanding the scope beyond the reported defect.

### Verify alpha bounds in an automated test

The test opens each small ICO frame and verifies that its non-transparent bounding box respects the configured safe area and still contains visible pixels. This protects against future regeneration accidentally returning to edge-to-edge artwork.

### Materialize the Windows icon at a content-addressed path

Hash the committed `.ico` bytes and copy them to `%APPDATA%\KnowMe\app-icon-<digest>.ico`. Identical content reuses the same file; changed content produces a new path, so the Windows taskbar cannot return the bitmap cached under the previous pathname.

Alternative considered: clear the Windows icon cache or restart Explorer. That mutates global desktop state, disrupts unrelated applications, and is unnecessary when the application can provide an immutable resource path.

### Reuse the safe-area lockup for the system tray asset

Generate `tray-icon.png` from the same centered KM renderer used by Windows small `.ico` frames. The main process continues to resize the committed tray source to 16 px at runtime, so this adds no startup computation or additional memory.

Alternative considered: add padding after `nativeImage.resize()` in the main process. Electron does not provide a direct canvas-style compositing API for predictable transparent margins, while the build-time renderer already produces deterministic alpha bounds.

## Risks / Trade-offs

- [The 16 px mark becomes smaller] → Keep the dedicated bold, bead-free KM lockup and limit padding to 12.5%.
- [Pillow ICO frame ordering/selection differs] → Save explicit frame sizes and test each frame by seeking all ICO representations.
- [Source and committed binary drift] → Regenerate `icon.ico` from the checked-in script and retain prebuild signature validation.
- [Old content-addressed files remain in userData] → Keep them because they are small and may still be referenced by the shell; avoid deleting a live cached resource.

## Migration Plan

Regenerate and commit `src/assets/icon.ico`. On the next app start, `ensureBrandIcons()` materializes a new content-addressed icon path, so no user migration or shell-cache clearing is required. Rollback consists of restoring the previous generator behavior and resource.
