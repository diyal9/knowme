## 1. Left navigation

- [x] 1.1 Add visible labels to existing rail entries while preserving IDs, order, grouping, tooltips, accessibility names, and actions.
- [x] 1.2 Introduce one rail-width CSS variable, widen the rail within the fixed window, and update button active/hover/focus/pressed states.
- [x] 1.3 Align center-surface overlays to the widened rail by replacing CSS and JS hard-coded offsets with the shared width source.

## 2. Workbench tabs

- [x] 2.1 Replace the workbench Home/Workflow segmented capsule styling with flat text tabs and an animated active underline.
- [x] 2.2 Verify existing tab semantics, switching behavior, and focused-state hiding rules remain unchanged.

## 3. Verification

- [x] 3.1 Add or update regression tests for labeled rail structure, shared overlay offset, and flat workbench tab rules.
- [x] 3.2 Run focused tests, full `npm test`, `npm run lint`, OpenSpec validation, and record the development self-test evidence.
- [x] 3.3 Run the Electron UI smoke at default/minimum sizing and capture navigation screenshots without runtime console errors.

## 4. Remove duplicate module branding

- [x] 4.1 Hide repeated module icon/title blocks from workbench, automation, capability, knowledge, settings, and the workbench task collaboration header while preserving contextual controls.
- [x] 4.2 Add regression coverage for the unified no-duplicate-title chrome.
- [x] 4.3 Re-run OpenSpec validation, tests, lint, and Electron visual smoke; update evidence.

## 5. Flatten capability tabs

- [x] 5.1 Replace the capability type capsule group and filled active state with flat labels and an active underline.
- [x] 5.2 Add regression and Electron visual checks for capability tab styling and switching.
- [x] 5.3 Re-run OpenSpec validation, full tests, lint, and update evidence.

## 6. Shorten assistant rail label

- [x] 6.1 Display “助理” in the rail while preserving the full office-assistant tooltip, accessible name, and action.
- [x] 6.2 Update regression coverage and re-run validation.
