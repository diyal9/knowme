## ADDED Requirements

### Requirement: Route-scoped CSS loading

The workspace shell MUST NOT statically import workbench-layout, run console, shelf, or capability-hub CSS on the default assistant route. Those stylesheets MUST load when their surface mounts (idempotent).

#### Scenario: Assistant cold start without workbench CSS

- **WHEN** the app opens on the assistant route
- **THEN** workbench-layout.css and capability-hub.css are not required for first paint of the shell and assistant column

### Requirement: Streaming must not thrash composer or memoized bubbles

During assistant streaming, the composer MUST NOT re-render solely because message text chunks updated. Historical bubbles with stable props MUST remain memo-skipped when only the live bubble text changes.

#### Scenario: Chunk flush

- **WHEN** a stream text chunk is flushed to the active assistant message
- **THEN** the composer does not subscribe to the full messages array for that update

### Requirement: Deferred file catalog on assistant mount

Assistant pane mount MUST NOT eagerly call `loadFileCatalog`. Catalog load MAY occur when the user opens @ suggestions, opens the files pane, or otherwise needs paths.

#### Scenario: Assistant mount

- **WHEN** AssistantPane mounts on an empty session
- **THEN** sessions/chrome may load, but file catalog load is deferred

### Requirement: Coalesced non-text stream events

Non-text `ai-stream-event` updates MUST be coalesced on rAF or ≤32ms cadence like text chunks, with flush on detach/session switch/stream end.

#### Scenario: Rapid tool stage events

- **WHEN** multiple stage events arrive within one frame
- **THEN** the store applies a single coalesced update for that frame
