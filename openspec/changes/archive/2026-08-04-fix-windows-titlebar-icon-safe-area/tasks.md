## 1. Small icon generation

- [x] 1.1 Add a centered 12.5% transparent safe area to the 16/24/32/48 px Windows KM icon renderer.
- [x] 1.2 Regenerate `src/assets/icon.ico` while preserving the existing 64/128/256 px frames.

## 2. Verification

- [x] 2.1 Add automated coverage for small-frame dimensions, transparent bounds, and visible KM content.
- [x] 2.2 Run OpenSpec validation, unit tests, lint, and the brand prebuild check.
- [x] 2.3 Restart KnowMe and verify the native Windows title-bar icon no longer appears clipped.

## 3. Windows taskbar cache refresh

- [x] 3.1 Materialize the bundled `.ico` at a content-addressed userData path and use that path for BrowserWindow and jump-list icons.
- [x] 3.2 Generate `tray-icon.png` from the safe-area KM lockup and add alpha-bound regression coverage.
- [x] 3.3 Rerun the development gates, truly restart the current Electron instance, and verify the Windows system tray uses the padded icon.
