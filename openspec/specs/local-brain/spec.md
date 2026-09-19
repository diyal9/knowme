# local-brain Specification

## Purpose
TBD - created by archiving change establish-local-brain-semantic-graph. Update Purpose after archive.
## Requirements
### Requirement: Local-first cognition

KnowMe MUST keep confirmed personal cognition, work relationships and evidence references locally and MUST NOT mirror external knowledge bodies by default.

#### Scenario: Mounted knowledge remains external

- **WHEN** an LLM Wiki, folder, GitLab repository or remote RAG Collection is mounted
- **THEN** Brain stores only Provider, Collection, topic, permission, health and reference metadata
- **AND** document bodies, chunks, vectors and full document graphs remain in the source system

### Requirement: Evidence and confirmation

Every durable relationship MUST resolve at least one Evidence reference. Inferred observations MUST require confirmation before driving stable personalization.

#### Scenario: Confirm a proposed relationship

- **WHEN** the user confirms a cognition proposal containing Evidence, nodes and a Claim
- **THEN** KnowMe persists Evidence before the Claim
- **AND** the confirmed Claim may participate in stable personalization

#### Scenario: Reject an unsupported relationship

- **WHEN** a durable Claim has no Evidence or references Evidence that does not exist
- **THEN** Brain rejects the write
- **AND** a legacy unsupported Claim is expired and excluded from retrieval paths

### Requirement: Federated retrieval

KnowMe MUST query only Agent-authorized Provider Collections and return provenance for every external hit. Provider failure MUST degrade without blocking local Brain use.

#### Scenario: Isolated Agent queries one Collection

- **WHEN** an Agent policy grants no personal Brain scopes and grants one RAGFlow Collection
- **THEN** the Agent can query only that Collection
- **AND** mixed query, direct Collection query and document fetch all enforce the same policy

#### Scenario: Empty Provider grant fails closed

- **WHEN** remote querying is enabled but the Agent Provider grant is empty
- **THEN** KnowMe issues no remote request
- **AND** guessed Collection or document identifiers are rejected

#### Scenario: Local source is read on demand

- **WHEN** an authorized folder or GitLab Provider is queried
- **THEN** content is read from its authorized source binding for that query
- **AND** paths outside the authorized root are rejected

### Requirement: Graph-assisted intelligence

Brain Query MUST use Claim status, authority, freshness, graph distance and conflict signals in ranking. It MUST return evidence-backed paths without representing inferred Claims as confirmed facts.

#### Scenario: Explain a multi-hop answer

- **WHEN** a result is connected to the current focus through multiple active Claims
- **THEN** the result includes relation node IDs, Claim IDs, labels, graph distance and Evidence
- **AND** the explanation states the Claim confirmation status

#### Scenario: Detect competing conclusions

- **WHEN** active Claims share a subject and predicate but point to different values
- **THEN** Brain marks the affected Claims and hits as conflicting
- **AND** applies a conflict penalty without deleting either history

### Requirement: Governed growth

Confirmed cognition, partner behavior and capability growth MUST be routed to Brain, Partner Profile and Capability Hub respectively. Every applied change MUST append a reversible audit event when a safe reverse effect exists.

#### Scenario: Confirm and undo growth

- **WHEN** the user confirms a Brain, partner behavior or capability proposal
- **THEN** KnowMe applies it through the matching target handler and records one Growth Ledger event
- **AND** undo restores the prior target state while retaining the audit event as reverted

### Requirement: Explainable product surface

The Brain home MUST expose relationship, status and source explanations, while preserving the existing library browser as a fallback view.

#### Scenario: Explore local cognition

- **WHEN** the user opens Brain
- **THEN** KnowMe presents the light-theme graph with self, work and knowledge perspectives
- **AND** offers stable star and categorized community views with at most 100 visible nodes

#### Scenario: Inspect a relationship

- **WHEN** the user selects two local nodes in relationship mode
- **THEN** Brain highlights the shortest evidence-backed path and explains it
- **AND** dragged node positions persist across reloads

#### Scenario: Inspect an external Collection

- **WHEN** the user selects an external Provider or Collection node
- **THEN** the Inspector shows status, topics, size, permissions and recent query metadata
- **AND** states that the source is read only during queries and is not part of local Brain cognition

#### Scenario: Graph rendering fails

- **WHEN** Brain graph loading or rendering fails
- **THEN** KnowMe falls back to the existing library view without blocking local documents

