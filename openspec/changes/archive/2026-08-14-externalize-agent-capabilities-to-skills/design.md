## Context

See `proposal.md` for motivation. KnowMe already has:

- standard `SKILL.md` L0–L3 loading, linked Cursor repository skills and sandboxed scripts;
- Capability Manifest v2 sidecars and dependency/risk/provenance normalization;
- Capability Pack scenes and a separate pack lifecycle;
- explicit slash Skill injection into Agent context;
- working but task-specific Renderer constants for office cards, quick menus, preflight and prompt enhancement.

The missing layer is a validated bridge from an enabled Skill/Pack to a generic Agent task surface. Current `game-studio` also declares `bundledCapabilities.catalogRoot`, but pack schema/runtime do not preserve or consume it.

## Goals / Non-Goals

**Goals:**

- Keep a portable Cursor/Claude Code `SKILL.md` as the primary instruction artifact.
- Add an optional, namespaced and declarative KnowMe experience contract without requiring non-standard fields in `SKILL.md`.
- Resolve active Pack Skill references as standard skill sources and inject explicit Skill L1 content for task activation.
- Replace office-specific Renderer execution tables with one normalized task catalog while retaining a legacy fallback.
- Preserve Electron process isolation: filesystem validation stays in main process; Renderer receives inert DTOs only.
- Avoid eager loading Skill bodies at startup; task discovery reads metadata and loads L1 only when activated.

**Non-Goals:**

- Skills do not register executable host tools or weaken Registry/security policy.
- This change does not replace Tool Registry work owned by `harden-workbench-tool-surface-runtime`.
- No arbitrary JavaScript expressions or remote resources are permitted in task declarations.

## Decisions

### D1: Keep standard SKILL.md and put structured experience metadata in the v2 sidecar

Each portable skill remains:

```text
<skill-id>/
  SKILL.md
  capability.manifest.json   # optional KnowMe extension
  references/                # optional
  assets/                    # optional
  scripts/                   # optional
```

The sidecar uses the existing normalized manifest and a namespaced field:

```json
{
  "schemaVersion": 2,
  "id": "feishu-related-chats",
  "kind": "skill",
  "name": "相关聊天",
  "version": "1.0.0",
  "dependencies": [{ "id": "feishu", "kind": "connector", "required": true }],
  "permissions": { "tools": ["feishu.related_chats"] },
  "metadata": {
    "knowme": {
      "experience": {
        "tasks": [{
          "id": "relatedChats",
          "title": "分析跟我相关的聊天",
          "subtitle": "今天：私聊/群聊主题与 @我",
          "icon": "chat",
          "group": "knowledge-collab",
          "modes": ["general"],
          "surfaces": ["empty", "quick-menu"],
          "prompt": "请分析跟我相关的聊天。",
          "preflight": {
            "type": "connector-auth",
            "connector": "feishu",
            "message": "..."
          },
          "requiredTools": ["feishu.related_chats"],
          "templateVars": { "days": 1 }
        }]
      }
    }
  }
}
```

Rationale: Cursor and Claude Code continue to consume `SKILL.md`; KnowMe gets structured arrays without expanding the intentionally small YAML-like parser. Alternative—large custom YAML blocks in frontmatter—was rejected because it is less portable and the current parser cannot safely represent nested task arrays.

### D2: Validate experience declarations in a pure adapter

Add a small `skill-experience` module that:

- validates task IDs and bounded strings;
- allowlists modes, surfaces, icons and preflight types;
- validates connector/tool names as declarative identifiers;
- permits only scalar `templateVars` with bounded size;
- returns `{ tasks, issues }` without mutating the standard Skill record.

Malformed optional experience metadata excludes only the invalid task. Unsafe fields such as approval bypass, script expressions, arbitrary URLs or secrets are never returned to Renderer.

`capability-manifest-v2` preserves only the validated namespaced extension. Legacy adapters produce an empty extension.

### D3: Treat enabled Pack skills as read-only standard Skill sources

Capability Pack schema preserves `bundledCapabilities.catalogRoot`. Runtime resolves each `manifest.skills` entry to `<catalogRoot>/skills/<id>/SKILL.md` and exposes active sources:

- bundled packs may resolve the existing trusted app catalog root, but never outside the application source/catalog boundary;
- imported packs must use a root inside the copied pack directory;
- every referenced Skill is validated before Pack enable/install succeeds;
- duplicate Skill IDs from another source are reported rather than silently overwritten.

Skill runtime merges sources with deterministic precedence:

1. user-managed installed Skill;
2. explicitly linked Cursor repository Skill;
3. enabled Pack-owned Skill;
4. legacy OKF.

Pack-owned sources are read-only and follow Pack enable/disable/uninstall automatically. This avoids duplicate file copies and makes bundled package updates content-hash visible. Alternative—copying Pack skills into the independent install store—was rejected because ownership rollback and update synchronization would duplicate package state.

### D4: Expose one inert task-catalog IPC

Main process builds `listSkillTasks()` from enabled Skill records and returns only normalized DTO fields. Pack scene data is adapted to the same DTO shape for backward compatibility.

IPC flow:

```text
Renderer -> preload.skillTaskList()
         -> main Skill/Pack runtime validation
         <- { tasks, issues, revision }
```

Renderer never receives sidecar paths, Skill bodies, scripts, permissions beyond display-safe dependency names, or filesystem access.

### D5: Activate tasks with an explicit Skill reference

Renderer keeps a task map keyed by normalized task ID. Both empty cards and quick-menu items call the same generic path:

1. evaluate declared deterministic preflight;
2. safely expand allowlisted date variables;
3. call `runAI` with the task prompt and explicit `skillRefs: [skillId]`;
4. main process loads Skill L1 through existing context assembly;
5. required host tools remain projected and executed by Registry/connector policy.

An explicit `skillRefs` argument is carried separately from displayed prompt so UI does not need to expose `/skill-id` text to the user.

### D6: Keep a bounded template engine

The only generated values are allowlisted host values (`today`, `dateRange`, `days`) derived from validated scalar `templateVars`. Expansion is plain token replacement; no evaluation, property access or function calls.

Most business instructions—including output headings and error behavior—live directly in `SKILL.md`. Sidecar `prompt` remains short and task-oriented. This keeps Skill behavior usable in Cursor/Claude Code even when the KnowMe sidecar is ignored.

### D7: Migrate current office capabilities without deleting safe fallbacks

Create standard catalog Skills for:

- `feishu-related-chats`
- `feishu-meeting-summary`
- `feishu-today-priority`
- `feishu-doc-kb`
- `office-requirement-doc`
- `office-document`
- `office-outline-draft`
- `office-document-finalize`

The existing game-studio Pack references the four Feishu skills through its catalog root and scenes point to those Skill IDs. Writing tasks are exposed by enabled catalog Skills; the existing hardcoded tables remain as compatibility fallback during migration but dynamic tasks take precedence by task ID.

Task-specific long instructions move from Renderer prompt enrichment into Skill bodies. Generic host grounding and Feishu tool result verification remain unchanged.

### D8: Preserve safety boundaries

- Connector auth readiness is checked by host APIs, not trusted from Skill text.
- `requiredTools` is compared to the run’s Registry projection; it does not create tools.
- scripts continue through `run_skill_script` sandbox and explicit permissions.
- writes continue through draft/approval paths.
- ToolLedger and grounding policies remain authoritative if Skill instructions conflict.

### D9: Cache metadata, not bodies

Task discovery caches normalized metadata by combined Skill/Pack content hash and invalidates on install, update, enable/disable or pack revision. L1 bodies are loaded only for explicit activation. Renderer stores only the latest DTO revision and refreshes after capability lifecycle actions or session initialization.

## Risks / Trade-offs

- [Risk] Existing hardcoded and dynamic entries can diverge during migration → Dynamic task IDs intentionally reuse current IDs; regression tests compare titles, prompts and preflight, while fallback remains until all migrated tasks pass.
- [Risk] Bundled catalog roots can escape a pack directory → Only trusted built-in packs may target the application catalog boundary; imported packs are pack-confined.
- [Risk] Skill instructions alone may not force a tool call → Required tools are also declared in sidecar/grounding metadata and checked through host execution/grounding.
- [Risk] Large task catalogs affect startup → Metadata-only scan is bounded and hash-cached; Skill bodies/scripts are not read into Agent context until activation.
- [Trade-off] Cursor ignores KnowMe task UI metadata → The core workflow remains in `SKILL.md`; only KnowMe-specific discovery/preflight presentation is omitted outside KnowMe.
- [Trade-off] Legacy constants remain temporarily → They provide rollback and old-install compatibility, but tests ensure migrated tasks use dynamic sources first.

## Migration Plan

1. Add experience validation and Skill runtime task discovery with tests.
2. Add Pack catalog-root source resolution and lifecycle checks.
3. Add task-catalog IPC and explicit task Skill references.
4. Add eight portable Skills and migrate existing Pack scenes/office entry mappings.
5. Run focused compatibility/security tests, full `npm test`, lint and Electron smoke.
6. Keep legacy fallback for one release; later removal requires a separate change after telemetry/QA confirms no fallback use.

Rollback: disable dynamic task IPC or the migrated Pack skills; Renderer falls back to existing task presets. No user content migration or destructive schema change is required.
