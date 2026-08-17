## Purpose

Requires React to call the same workbench, daemon, session, hub, and source capabilities that f6ad048 already exposed through preload, instead of local stubs or missing menus.

## ADDED Requirements

### Requirement: Prefer existing IPC over stubs
Where `f6ad048` preload already invoked a channel and current `src/ipc/*.ts` still registers it, the React surface MUST call that API. Fake log lines, in-memory-only sessions, and disabled hub writes MUST NOT stand in for those channels.

#### Scenario: Task room uses daemon gate
- **WHEN** a workflow run hits a human gate
- **THEN** the UI MUST call `workbenchDaemonGate` (or the baseline-equivalent launch/daemon API) rather than only toggling local phase state

### Requirement: Agent sessions persist
Assistant session tabs MUST list, create, switch, and restore transcripts via `agentSessionList` / `agentSessionNew` / `agentSessionGet` (and related session APIs present in baseline preload).

#### Scenario: Restart keeps sessions
- **WHEN** the user creates a session, sends a message, and relaunches the app
- **THEN** the session tab and transcript remain available from the session store

### Requirement: File catalog uses content sources
`@` file suggestions MUST come from content-source tree APIs (`sourcesTree` / `sourcesTreeChildren` or an IPC that wraps them). The UI MUST NOT require a missing `agentFileCatalog` channel.

#### Scenario: At-mention without notes
- **WHEN** the user types `@` with a bound local or GitLab source
- **THEN** recent files from that source appear; note-library IDs MUST NOT be required

### Requirement: Capability hub write paths
Expert / skill / connector catalog MUST support baseline add/import/detail drawer actions through existing capability and skill IPC, not a read-only grid only.

#### Scenario: Add capability
- **WHEN** the user chooses 添加能力 and completes a baseline import path (folder / zip / custom)
- **THEN** the catalog refreshes from `capabilityList` / pack IPC and the new item is visible

### Requirement: Notes product stays retired
Independent note windows, list overview, notes backup, and tray note actions MUST stay unavailable even though `f6ad048` still had them.

#### Scenario: No note window
- **WHEN** the user searches rail, tray, and settings for 新建便签 or 便签总览
- **THEN** those entries MUST NOT open a note BrowserWindow
