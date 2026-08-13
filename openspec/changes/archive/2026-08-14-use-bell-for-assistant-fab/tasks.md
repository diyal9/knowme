## 1. Assistant FAB icon

- [x] 1.1 Replace only the floating assistant trigger glyph with a single-color outlined bell while preserving the panel brand avatar.
- [x] 1.2 Tune the bell SVG size and scoped stroke styling for clear light/dark-theme rendering without changing the transparent hit area or status badge.

## 2. Verification

- [x] 2.1 Update regression tests for the bell structure, unique resume indicator, and unchanged FAB interaction contract.
- [x] 2.2 Run focused tests, full tests, lint, strict OpenSpec validation, and record development self-test evidence.
- [x] 2.3 Restart Electron and capture a UI screenshot confirming the bell is clear and no runtime errors are introduced.

## 3. Producer feedback: badge alignment

- [x] 3.1 Move the resume status dot from the button's left edge to the bell's upper-right edge.
- [x] 3.2 Add a regression assertion for upper-right badge positioning and refresh visual evidence.
- [x] 3.3 Re-run tests, lint, strict OpenSpec validation, and restart Electron.
