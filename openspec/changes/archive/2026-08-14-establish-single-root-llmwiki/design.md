## Context

See `proposal.md` for motivation. Runtime currently has a visible `knowledge-os` rooted at `%APPDATA%\KnowMe\knowledge-os\wiki`, a legacy `%APPDATA%\KnowMe\knowledge` OKF store, optional external root binding, Fabric/governance modules, and product Memory. The visible knowledge surface exposes six primary tabs plus secondary routes. `knowledge-os` already confines most paths but writes ingest files directly and has no single operation harness, no stale-write protection, and no embedded raw editor.

Electron constraints require all filesystem access to remain in the main process. The renderer may request operations through narrow preload APIs but must never receive arbitrary filesystem primitives. Startup must not recursively scan the knowledge tree; indexing and full Harness checks remain on-demand.

## Goals / Non-Goals

**Goals:**

- Establish a deterministic managed root Wiki contract without adding example facts.
- Route user-editable raw reads and writes through one strict, testable Harness.
- Keep the renderer limited to relative paths, content and expected hashes.
- Reduce the default knowledge surface to user tasks while preserving advanced runtime compatibility.
- Refresh retrieval state only after successful mutations.
- Route every root query through the qmd adapter and expose one reusable root service to UI, Agent and other main-process modules.

**Non-Goals:**

- Removing legacy OKF, Fabric, remote RAG or Obsidian modules.
- Rich-text/WYSIWYG editing, binary document editing or collaborative locking.
- Recursively validating the whole root during application startup.

## Decisions

### 1. Treat the managed root as a versioned contract

The managed root contains:

- `raw/`: user-visible Markdown and text source material.
- `concepts/`: accepted stable knowledge.
- `.knowme/llmwiki.json`: hidden schema/version metadata.

Initialization creates only structure and metadata. It does not copy `knowledge-seed`, because those product-help documents would be retrieved as if they were user facts.

Alternative considered: continue using arbitrary root files plus `inbox/`. Rejected because it gives the editor no strict write boundary and makes health checks ambiguous.

### 2. Add a pure Node LLM Wiki Harness below knowledge-os

A dedicated module owns root initialization, inspection, raw path resolution, content hashing, raw reads and atomic writes. It accepts explicit root paths and has no Electron dependency, so unit tests and a CLI wrapper can run it directly.

The Harness enforces:

- relative normalized paths under `raw/`;
- `.md`, `.markdown` and `.txt` only;
- bounded UTF-8 content;
- no symbolic-link traversal;
- optional expected-hash optimistic concurrency;
- same-directory temporary write followed by atomic replacement;
- stable JSON-shaped reports and error codes.

`knowledge-os` remains the orchestration layer: after a successful Harness mutation it refreshes the index and invalidates caches. Failed mutations do neither.

Alternative considered: add checks independently to each IPC handler. Rejected because duplicated policy would drift and could not be exercised as one gate.

### 3. Keep filesystem authority in the main process

Main-process IPC handlers expose root status, raw read, raw save and existing ingest operations. Preload forwards only structured payloads. The renderer never receives absolute write paths and cannot call Node `fs`.

Raw save carries `{ path, content, expectedHash }`. A mismatch returns `code: "stale_content"` while preserving the editor buffer. Successful responses return the new hash and timestamp.

### 4. Make raw the default ingest destination

Pasted text and imported text files are written into `raw/`. Existing files in legacy `inbox/` or root-level folders remain readable and searchable; no automatic destructive move occurs. Accepted整理 proposals continue to land in `concepts/`.

Alternative considered: migrate every existing file into `raw/` immediately. Rejected because external links and user-authored paths could break.

### 5. Collapse navigation without deleting advanced capability

The default tabs become “我的知识”“待我确认”“来源”. Search, add-material actions and recent documents live on “我的知识”. Browse is a contextual subview; the editor appears only for allowed raw files. Fabric, governance and detailed retrieval routes remain callable for compatibility and tests but are not default tabs.

UI copy uses only “资料”“已整理知识”“待我确认”“来源”. Internal terms may remain in diagnostic output and developer logs.

### 6. Keep checks proportional to startup cost

Startup only performs idempotent directory/manifest initialization. Full Harness inspection, recursive lint and index rebuilding run when the knowledge surface opens, the user requests a check, a mutation succeeds, or the CLI gate runs. This avoids adding recursive I/O to Electron startup and bounds memory to existing index limits.

### 7. Put a task-oriented service boundary above knowledge-os

`llmwiki-service` is the single application-facing interface for root `query`, `ingest` and `lint`. `knowledge-os` remains responsible for files, indexes and domain operations; `qmd-engine` remains responsible for qmd process discovery, collection synchronization, query execution and lexical fallback.

The service returns a stable operation envelope including the user action, result, retrieval engine and degraded state. Existing IPC names remain as compatibility aliases, while renderer-facing names use “查找知识”“添加资料”“检查问题”. Agent `search_knowledge` uses the same root query service, so UI and AI do not silently use different indexes.

For qmd, availability is auto-detected unless explicitly disabled. A KnowMe-scoped collection name is derived from the root path to avoid overwriting unrelated global qmd collections. The adapter uses the documented CLI shape `qmd query <query> --json -n <n> -c <collection>`, maps `file`, `snippet`, `body` and `context` fields into the shared hit contract, and incrementally updates the collection after successful writes. If qmd is missing, indexing fails, or a query fails, the adapter falls back to the in-process lexical ranker and reports the reason without blocking knowledge use.

Alternative considered: let each caller choose between `knowledge-os.query`, Fabric and qmd directly. Rejected because UI, Agent and modules could return different answers for the same root and mutations could leave one index stale.

### 8. Separate the product entry name from the root page name

The persistent left rail is the product capability entry “知识网”. Inside it, the default root page is “我的知识”, followed by “待我确认” and “来源”.

The home page is an index, not a workflow dashboard. It builds a tree from the same indexed entries used by browse/search, preserves actual subdirectory hierarchy, and injects only the two empty contract directories that physically exist after Harness initialization. Top-level contract names are translated (`raw` → “资料”, `concepts` → “已整理知识”), while user-created subdirectory names and document titles remain unchanged. The first two directory levels open by default; selecting a file hands off to the existing reader/editor.

No inferred AI topic is written into or displayed as if it were a real directory. Future semantic topic views may be added separately only when their provenance is explicit.

## Risks / Trade-offs

- [Existing users have files outside `raw/`] → Keep them readable/searchable but read-only in the embedded editor; users can import or recreate editable copies in `raw/`.
- [External tools modify a file while it is open] → Require expected hash and return a stale-content conflict without replacing either version.
- [Windows rename can fail when antivirus holds a file] → Use a same-directory temporary file, attempt rename, and clean up on failure; never report success before replacement completes.
- [Advanced routes become less discoverable] → Preserve APIs and deep routes, but keep them out of the default navigation until the root workflow is stable.
- [Legacy `%APPDATA%\KnowMe\knowledge` still exists] → Treat it as compatibility storage for existing skill/OKF features; do not present it as a second user-selectable library in this change.
- [qmd is not installed on a machine] → Keep the root fully usable through lexical fallback, expose the degraded engine status to diagnostics, and never claim hybrid retrieval ran when it did not.
- [qmd global collection name collision] → Use a deterministic KnowMe-scoped collection name derived from the canonical root path.

## Migration Plan

1. On startup, create/repair the managed root contract without scanning or moving existing content.
2. Keep valid existing external root bindings readable; new installations use the managed root automatically.
3. Change new ingest output from `inbox/` to `raw/`; continue indexing existing `inbox/` files.
4. Expose raw edit IPC and update the knowledge surface.
5. Run the Harness and existing lint/index tests against fresh, legacy and invalid fixtures.

Rollback consists of restoring the previous UI routes and ingest destination. The new `raw/` files remain ordinary Markdown/text files and continue to be indexed by older code, so rollback does not lose user data.
