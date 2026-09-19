# Local Brain Cognition Loop Delta

## ADDED Requirements

### Requirement: Governed conversation observation

KnowMe MUST treat conversation-derived cognition as a reviewable observation before it can become stable Brain knowledge.

#### Scenario: Observe an explicit preference

- **WHEN** the personal Agent receives a clear user preference while learning is enabled
- **THEN** KnowMe creates one Evidence-backed pending cognition proposal
- **AND** does not create a confirmed Claim before user confirmation

#### Scenario: Ignore unsafe observation contexts

- **WHEN** the conversation is ephemeral, learning is disabled, the text is sensitive, or the Agent is not allowed to learn
- **THEN** KnowMe does not create a cognition proposal

### Requirement: Memory promotion bridge

KnowMe MUST route eligible repeated Memory patterns through the same Brain proposal surface.

#### Scenario: Reach the promotion threshold

- **WHEN** an eligible preference pattern reaches the configured repetition threshold
- **THEN** one pending Brain proposal is created with the pattern as evidence
- **AND** confirming or rejecting the proposal updates the Memory pattern review state

### Requirement: Stable proposal lifecycle

KnowMe MUST keep proposal decisions deterministic, editable and reversible.

#### Scenario: Repeat a reviewed observation

- **WHEN** the same fingerprint is observed after its proposal was rejected or confirmed
- **THEN** no new pending proposal is created

#### Scenario: Edit before confirmation

- **WHEN** the user changes the proposed cognition and confirms it
- **THEN** the edited content is written to the Brain node and relation
- **AND** the original Evidence remains available for explanation

#### Scenario: Undo confirmed cognition

- **WHEN** the user reverses a cognition Growth Ledger event
- **THEN** the applied Brain effects are reverted
- **AND** the ledger retains a reverted audit record

### Requirement: Explainable review surface

The review surface MUST explain a proposal in product language and refresh Brain immediately after a decision.

#### Scenario: Review a cognition proposal

- **WHEN** the user opens a pending proposal
- **THEN** the UI shows what was observed, why it was proposed, its evidence and its destination
- **AND** offers edit-and-confirm, reject and snooze actions
