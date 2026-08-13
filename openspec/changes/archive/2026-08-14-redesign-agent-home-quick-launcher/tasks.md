## 1. Home recommendation hierarchy

- [x] 1.1 Add a pure partition helper that caps recommendations at four and separates workflow/overflow entries.
- [x] 1.2 Render capability-pack home as a four-card grid plus a distinct workflow intake entry.
- [x] 1.3 Preserve existing task preflight and execution for cards and workflow intake.

## 2. Searchable command launcher

- [x] 2.1 Replace the two-column category/subitem markup and styles with a focused searchable command panel.
- [x] 2.2 Flatten legacy and dynamic task sections into searchable command records with useful metadata.
- [x] 2.3 Implement query filtering, empty results, active-row rendering and draft-safe open/close focus behavior.
- [x] 2.4 Implement Ctrl/Cmd+K, ArrowUp/ArrowDown, Enter and Escape behavior against the filtered result list.

## 3. Verification and handoff

- [x] 3.1 Add unit coverage for four-card partitioning, workflow extraction and command filtering.
- [x] 3.2 Update workspace smoke assertions for four recommendations, workflow entry and launcher copy.
- [x] 3.3 Run test/lint and a targeted Electron smoke; record `evidence/dev-self-test.md`.
