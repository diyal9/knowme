## 1. Display name derivation

- [x] 1.1 Add `src/lib/expert-display-name.js` with a pure `deriveExpertDisplayName` covering the name / persona.role / description-title / fallback chain.
- [x] 1.2 Cover the derivation with unit tests, including language-prefix stripping, parenthetical removal, length cap and the no-Chinese fallback.

## 2. Import pipeline

- [x] 2.1 Use the derived display name when scanning Cursor repositories, for both `.cursor/agents` experts and skill-generated repository experts, and carry `originName`.
- [x] 2.2 Persist `originName` through the expert package, install store and catalog overlay.
- [x] 2.3 Keep a user-renamed expert's name on re-scan and re-register.

## 3. Rename and backfill

- [x] 3.1 Sync `expert-save` renames into install store and catalog overlay and mark them as user-named.
- [x] 3.2 Backfill existing imported experts once, idempotently, on capability service init.

## 4. Capability Hub surface

- [x] 4.1 Show the display name as the card / drawer title and demote the original identifier to the card subtitle and drawer metadata.
- [x] 4.2 Keep the original identifier searchable.

## 5. Verification

- [x] 5.1 Run OpenSpec validation, `npm test` and `npm run lint`; record dev self-test evidence.
- [x] 5.2 Verify in the running app that imported experts show Chinese names, rename survives a re-scan, and capture screenshot evidence.
