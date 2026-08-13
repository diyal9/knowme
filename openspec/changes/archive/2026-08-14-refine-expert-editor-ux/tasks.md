## 1. Catalog picker module

- [x] 1.1 Add `src/lib/catalog-picker.js` with render/filter/selected helpers and empty-state install guidance.
- [x] 1.2 Add picker dialog markup in `capability-hub.html` and load the module.
- [x] 1.3 Wire expert editor Skills / Tool / 知识库 to compact summary + picker dialog apply/cancel.

## 2. Editor chrome and Agentic controls

- [x] 2.1 Enlarge `.hub-expert-dialog` and refine section spacing while keeping KnowMe tokens.
- [x] 2.2 Replace AgenticType native select with a divided custom listbox that still writes `#hubExpertAgenticType`.
- [x] 2.3 Restyle Agentic boolean options so checkbox and label sit on one row.

## 3. Avatar row

- [x] 3.1 Make the avatar picker a single-row horizontal scroller.
- [x] 3.2 Remove the auto-match button and hint; keep silent default matching on create until the user picks manually.

## 4. Verification

- [x] 4.1 Extend `tests/capability-hub.test.js` and add `tests/catalog-picker.test.js` for the new contracts.
- [x] 4.2 Run `npm test` and `npm run lint`; write `evidence/dev-self-test.md`.
