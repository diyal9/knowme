## 1. Shared center-surface navigation

- [x] 1.1 Add a dynamic center-surface tablist to the drawer header with shared flat underline, focus, pressed, reduced-motion, and narrow-width overflow styles.
- [x] 1.2 Add tab semantics, active-state synchronization, and lifecycle cleanup for knowledge and settings center surfaces.

## 2. Knowledge pages

- [x] 2.1 Add Browse, Sources, and Health top-level knowledge tabs while keeping entry filters as secondary controls.
- [x] 2.2 Promote the existing provider list into the Sources page and preserve provider switching plus configuration dialogs.
- [x] 2.3 Reuse the existing lint result UI as the Health page and preserve browsing, source data, and AI handoff behavior.

## 3. Settings integration

- [x] 3.1 Render existing settings categories in the outer center-surface tablist and hide the duplicate embedded titlebar.
- [x] 3.2 Synchronize valid setting categories between the parent shell and current iframe with source-checked messages.

## 4. Verification

- [x] 4.1 Add regression coverage for shared tab styling, knowledge page routing, settings iframe synchronization, semantics, and responsive overflow.
- [x] 4.2 Run focused tests, full `npm test`, `npm run lint`, strict OpenSpec validation, and record development self-test evidence.
- [x] 4.3 Run Electron visual smoke for knowledge, settings, tab switching, and minimum window width without runtime console errors.
