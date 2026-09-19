# Local Brain Refinement Delta

## ADDED Requirements

### Requirement: Role-aware taxonomy scaffold

KnowMe MUST initialize a versioned knowledge classification scaffold from the current occupation while keeping the scaffold distinct from learned cognition.

#### Scenario: Initialize an empty Brain

- **WHEN** a user opens Brain before confirming any cognition
- **THEN** KnowMe shows the fixed categories for the current occupation
- **AND** the categories do not increase understood-cognition statistics or appear as Brain Query hits

#### Scenario: Change occupation

- **WHEN** the configured industry or occupation changes
- **THEN** KnowMe idempotently replaces the prior scaffold with the new role scaffold
- **AND** preserves confirmed user cognition, evidence and growth history

### Requirement: Compact graph workspace

The Brain home MUST prioritize graph canvas space while keeping filters and explanation available on demand.

#### Scenario: Open Brain home

- **WHEN** Brain graph view loads
- **THEN** the filter rail is compact and the Inspector is closed by default
- **AND** the user can expand either panel with keyboard-accessible controls

### Requirement: External knowledge library management

The Sources surface MUST manage federated Provider metadata and authorization without representing external bodies as Local Brain cognition.

#### Scenario: Manage a Provider

- **WHEN** the user selects a mounted or remote Provider
- **THEN** the detail surface shows health, Collections, document counts, recent use and data boundary
- **AND** selection does not change the default Provider until the user explicitly chooses that action

#### Scenario: Authorize a remote Collection

- **WHEN** the user changes a Collection checkbox
- **THEN** KnowMe persists only the Agent-readable Collection ID grant
- **AND** does not import document bodies, chunks or vectors

#### Scenario: Disconnect a Provider

- **WHEN** the user disconnects an external Provider
- **THEN** the Provider is removed from active routing
- **AND** durable references remain auditable with the source marked unavailable
