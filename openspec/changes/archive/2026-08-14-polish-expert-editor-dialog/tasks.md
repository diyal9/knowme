## 1. Dialog structure

- [x] 1.1 Restructure the expert editor form into labelled groups with aligned padding and required-field markers.
- [x] 1.2 Render Skills / Tools / knowledge scope as responsive card-style multi-select groups with counts and bulk actions.
- [x] 1.3 Switch large catalogs to browse mode: category subgroups, bounded scrolling, in-group search and an only-selected review toggle.

## 2. Interaction

- [x] 2.1 Keep group counts and the footer selection summary in sync with checkbox, select-all and clear actions.
- [x] 2.2 Highlight and focus the missing required field when saving is blocked.

## 3. Verification

- [x] 3.1 Extend `tests/capability-hub.test.js` with static contracts for grouping, card multi-select, summary and validation.
- [x] 3.2 Run OpenSpec validation, `npm test` and `npm run lint`; record dev self-test evidence.
- [x] 3.3 Verify the dialog on desktop and narrow widths and save screenshot evidence.
