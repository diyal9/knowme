## Context

See `proposal.md` — Why. List projection lives in `daemonRunRecordView` / `daemonTaskCardView` (`src/lib/workbench-daemon-surface.js`); DOM uses `cardTitle` in `renderDaemonMode`.

## Goals / Non-Goals

**Goals**
- Deterministic, pure-function title compaction for card primary line.
- Keep full intent searchable and available via tooltip.
- Single-line visual clamp for card title.

**Non-Goals**
- Renaming/deleting historical daemon tasks in the remote DB.
- Changing create-dialog intent validation or storage.
- Hiding slug/meta row (out of scope unless still noisy after title fix).

## Decisions

1. **Compact in projection, not only CSS**  
   Line-clamp alone still shows URL as the “title”. Prefer deriving `cardTitle` in `compactDaemonCardTitle(intent, { pathName, slug })`.

2. **Heuristic order**  
   - Prefer first non-empty line that is not URL-like after stripping prefixes like `需求文档：` / `PRD:`  
   - If a line is only a label and the rest is URL-only → use that label (e.g. `需求文档`)  
   - Else fall back to `pathName` → `slug` → `管线记录`  
   - Hard truncate ~48 chars with `…`

3. **`title` vs `cardTitle`**  
   Keep `title` / `intentTitle` as full intent for search + tooltip; only `cardTitle` is compact.

4. **CSS**  
   `-webkit-line-clamp: 1` (was 2) on `.wb-daemon-task-copy strong`.

## Risks / Trade-offs

- [Heuristic misses good first line] → Mitigation: unit tests for common paste patterns; tooltip keeps full text.
- [Short Chinese goals truncated at 48] → Acceptable for list density; rare for real titles.

## Migration Plan

No data migration. Ship with app restart.

## Open Questions

None.
