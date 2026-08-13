## 1. Previous Unified Small Icon Rendering

- [x] 1.1 Replace the standalone navy KM small renderer with a bead-free, heavier-stroke double-layer speech-bubble renderer.
- [x] 1.2 Apply the unified renderer to 16/24/32/48 px ICO frames and the tray source while preserving transparent safe-area bounds.
- [x] 1.3 Regenerate `icon.ico` and `tray-icon.png` without changing the full-size `icon.png`.

## 2. Verification

- [x] 2.1 Extend brand icon tests to verify native frame sizes, alpha bounds, visual footprint, and expected brand colors.
- [x] 2.2 Run targeted icon tests, full tests, lint, OpenSpec validation, and record development self-test evidence.
- [x] 2.3 Restart KnowMe and confirm the updated content-addressed Windows icon loads without startup errors.

## 3. Previous Producer Feedback Iteration

- [x] 3.1 Reduce small-frame safe padding to 1–3 native pixels and enlarge the speech-bubble composition.
- [x] 3.2 Generate the tray asset at its native 16 px target to remove compounded downsampling blur.
- [x] 3.3 Add visual-footprint and native tray-dimension regression assertions.
- [x] 3.4 Regenerate assets, rerun targeted verification, and restart KnowMe for producer re-acceptance.

## 4. Previous High-DPI Clarity Iteration

- [x] 4.1 Replace the 16 px tray source with a 32 px 2× representation.
- [x] 4.2 Load the Windows tray PNG with an explicit 2× scale factor instead of resizing it to 16 px.
- [x] 4.3 Update regression tests, regenerate assets, and restart for producer re-acceptance.

## 5. Connected Brand Mark Iteration

- [x] 5.1 Update the OpenSpec artifacts and SVG master to the producer-approved five-node connected mark.
- [x] 5.2 Replace the generator with deterministic connected-mark rendering for the master PNG, every ICO frame, and the 32 px tray source.
- [x] 5.3 Align icon loaders, comments, and automated tests with the unified connected palette and geometry.
- [x] 5.4 Regenerate all application icon assets and verify native-frame alpha bounds, palette, dimensions, and source consistency.
- [x] 5.5 Restart KnowMe and capture development self-test evidence before producer re-acceptance.
