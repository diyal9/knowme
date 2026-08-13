## Context

See `proposal.md` for motivation. The renderer already exposes a three-tab knowledge surface and the “我的知识” page already calls root Query, Ingest, and Lint compatibility aliases. Main-process handlers route these operations through `llmwiki-service`, which prefers qmd and returns retrieval metadata. An Obsidian bridge already handles installation detection, vault registration, opening, and optional graph deep links.

Electron keeps filesystem authority in the main process. The renderer receives indexed entries and structured operation results through narrow preload APIs; it must not gain Node or arbitrary filesystem access. This change is primarily a renderer information-architecture change and must not add startup scanning, persistent graph state, or a third-party visualization dependency.

## Goals / Non-Goals

**Goals:**

- Make Query, Ingest, and Lint the obvious first actions on the knowledge home.
- Surface qmd versus local fallback status from the existing query response truthfully.
- Keep directory, recent, health, and review information available without competing with primary tasks.
- Promote the existing Obsidian handoff as the professional relationship-graph path.
- Preserve the current three-tab navigation and all compatibility routes.

**Non-Goals:**

- Building a graph model, canvas renderer, backlinks index, or Obsidian replacement.
- Changing root Wiki storage, qmd collection semantics, or Agent retrieval behavior.
- Removing Fabric, governance, remote RAG, or Obsidian compatibility code.

## Decisions

### 1. Restructure the existing status page instead of adding another route

`renderKnowledgeStatusWorkspace` remains the default route and becomes the operation hub. Its primary column contains positioning copy, the Query input/results, and direct Ingest/Lint actions. A supporting column contains review, recent documents, health, directory access, and Obsidian.

Alternative considered: add a fourth “操作” tab. Rejected because it recreates the navigation burden this change is intended to remove.

### 2. Reuse the root service response rather than probe qmd separately

The home Query continues through the existing renderer alias and main-process `llmwiki-service.query`. The renderer reads `result.retrieval.actual`, `degraded`, and `reason` from that response to display either “qmd 结构化检索” or “本地检索”.

Alternative considered: call the engine-status IPC before every search. Rejected because a preflight probe can disagree with the actual query execution and adds latency.

### 3. Reuse existing Ingest, Lint, browse, and Obsidian flows

The hub only changes discoverability and composition:

- Ingest opens the existing add-material modal and writes through the main-process service to `raw/`.
- Lint opens the existing health route backed by the shared service.
- Query hits open the existing browser/editor.
- Obsidian opens the existing bridge modal, which handles installed and uninstalled states.

This avoids new IPC authority and keeps security policy centralized in the main process.

### 4. Keep qmd state useful but user-readable

The result area displays the actual retrieval engine after a query. Internal failure codes are not shown verbatim; a degraded result says that local retrieval was used and knowledge remains available. Detailed diagnostics remain in logs or advanced surfaces.

Alternative considered: hide fallback details entirely. Rejected because the product must not imply that structured qmd retrieval ran when it did not.

### 5. Keep rendering bounded and responsive

The home uses the existing bounded entry list and shows only a small recent subset and bounded query result list. No additional recursive scan occurs during startup or page open. CSS switches the two-column composition to a single column at the existing narrow-window breakpoint.

## Risks / Trade-offs

- [qmd is unavailable on many machines] → Keep local fallback fully usable and disclose it only after the actual query result.
- [Users may expect an in-app graph from the name “知识网”] → Provide a visible “在 Obsidian 中打开” action with copy that names relationship graphs explicitly.
- [Existing tests assert exact legacy homepage copy] → Update focused knowledge-page contracts while preserving stable element ids where practical.
- [Advanced routes become less discoverable] → Preserve deep routes and APIs; do not make them primary navigation.

## Migration Plan

1. Add the revised home composition and styles without changing storage or IPC contracts.
2. Update knowledge-page tests and run Electron smoke at desktop and narrow widths.
3. Rollback consists of restoring the prior status-page renderer and styles; no user data or indexes require migration.
