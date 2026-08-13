# knowledge-fabric-runtime

## ADDED Requirements

### Requirement: KB Registry metadata

The system SHALL normalize knowledge providers with scope, authority (1-5), retrievalTier, writable, promotable, and collectionId.

#### Scenario: Default personal root library

- **WHEN** the active provider is the default local library
- **THEN** it exposes authority 2, scope client, collectionId root, writable and promotable true

### Requirement: Fabric graph persistence

The system SHALL persist concept/anchor nodes and typed edges under `%APPDATA%/KnowMe/knowledge-os/fabric/graph.json`.

#### Scenario: Seed concepts from wiki

- **WHEN** fabric graph is empty and wiki entries exist
- **THEN** concept nodes are created from wiki/okf index on first list

### Requirement: Root-first retrieval

The system SHALL search the root fabric first, route to external libraries selectively, fuse with RRF and authority weighting, and annotate conflicts along contradicts edges.

#### Scenario: Fallback without models

- **WHEN** qmd is unavailable and no embed function is configured
- **THEN** lexical ranking still returns hits

### Requirement: Weave proposals

The system SHALL generate weave proposals with anchors and edges for human apply/reject before writing to graph.

#### Scenario: Apply weave proposal

- **WHEN** user accepts a pending weave proposal
- **THEN** anchor nodes and edges are written to graph.json

### Requirement: Agent fabric tools

Agent runtime SHALL expose fabric-aware search via search_knowledge and dedicated fabric_search, kb_query, kb_get tools.

#### Scenario: Search knowledge uses fabric

- **WHEN** an agent calls search_knowledge
- **THEN** fabric retrieval orchestration is invoked
