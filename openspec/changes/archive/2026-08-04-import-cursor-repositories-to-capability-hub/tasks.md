## 1. Repository discovery and data model

- [x] 1.1 Implement a bounded, read-only Cursor repository scanner for skills, agents and safe MCP stdio definitions
- [x] 1.2 Extend install store and catalog overlay metadata for linked repository origins and make user-installed entries visible
- [x] 1.3 Implement idempotent repository registration, Agent-to-Expert adaptation and skill-only repository Expert generation

## 2. Runtime integration

- [x] 2.1 Load enabled linked skills from registered repository paths with root confinement and missing-source handling
- [x] 2.2 Synchronize safe imported MCP connectors with the existing connector store and lifecycle
- [x] 2.3 Preserve existing Expert snapshot behavior while exposing imported experts to trial chat

## 3. Capability Hub interaction

- [x] 3.1 Add scan/import IPC and preload bridges plus a Cursor repository folder picker
- [x] 3.2 Add Cursor repository preview, confirmation, partial-result feedback and explicit local trust retry to the Hub UI
- [x] 3.3 Ensure imported cards immediately appear with truthful source, status and availability
- [x] 3.4 Replace the rail's mechanical component glyph with a lighter capability-stack icon and verify active-state clarity

## 4. Verification

- [x] 4.1 Add unit tests for scanning, secret blocking, ID collision handling, idempotent registration and linked skill runtime
- [x] 4.2 Add integration tests for IPC/UI wiring and non-curated catalog visibility
- [x] 4.3 Run OpenSpec validation, focused tests, full `npm test`, lint and record development self-test evidence
