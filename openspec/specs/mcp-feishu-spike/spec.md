# mcp-feishu-spike Specification

## Purpose
TBD - created by archiving change spike-mcp-host-feishu. Update Purpose after archive.
## Requirements
### Requirement: Spike evidence is recorded

The change MUST record machine-verifiable findings for `lark-cli` availability, identity readiness, and MCP SDK dependency status under `evidence/`.

#### Scenario: lark-cli present

- **WHEN** the Spike investigation runs on a developer machine with `lark-cli` installed
- **THEN** evidence documents CLI version and `doctor` identity statuses (bot/user)

#### Scenario: MCP dependency status

- **WHEN** the Spike checks the KnowMe package dependencies
- **THEN** evidence states whether `@modelcontextprotocol/sdk` is present and recommends a Host approach

### Requirement: Tool danger tiers

The Spike MUST publish a danger tier table (L0–L4) that subsequent connector Stories SHALL use for allowlist and human-in-the-loop policy.

#### Scenario: Write operations classified

- **WHEN** a Feishu operation would create, update, send, or delete platform data
- **THEN** it is classified at least L3 (platform write) or L4 (destructive), never L1

### Requirement: No runtime product change

This Spike MUST NOT modify Agent tool execution runtime behavior in `src/`.

#### Scenario: Stub remains

- **WHEN** the Spike Story completes
- **THEN** product connectors remain non-functional stubs until `knowme-connectors` lands

