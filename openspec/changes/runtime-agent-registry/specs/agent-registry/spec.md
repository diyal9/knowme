## ADDED Requirements

### Requirement: Runtime Agent creation is source-code independent

KnowMe MUST create and update professional Agent packages in the runtime capability directory. Creating an Agent MUST NOT require changes to the bundled catalog or application source code.

#### Scenario: Create a professional Agent at runtime

- **WHEN** a valid professional Agent definition is previewed, explicitly approved and committed
- **THEN** KnowMe writes the Expert package and schema-v3 capability manifest under user data
- **AND** registers it in the Install Store and Catalog Overlay
- **AND** the Agent becomes available to the workbench without an application restart or source edit

### Requirement: Professional definitions pass a quality gate

KnowMe MUST validate identity, scope, boundaries, inputs, outputs, dependencies, permissions, risk, execution routes, deliverables and quality review before publishing a runtime Agent.

#### Scenario: Definition is structurally valid but professionally incomplete

- **WHEN** an Agent has a persona but lacks task boundaries, execution routes or quality criteria
- **THEN** preview reports blocking quality issues
- **AND** commit performs no write

### Requirement: Agent changes use preview-confirm-commit

KnowMe MUST bind every runtime Agent mutation to an opaque preview token and the current Agent content hash. A write-capable Agent tool MUST also pass host approval.

#### Scenario: Agent changes after preview

- **WHEN** the current Agent hash differs from the hash captured by the token
- **THEN** commit is rejected as stale
- **AND** a new preview and approval are required

### Requirement: Retirement preserves historical work

KnowMe MUST represent normal Agent removal as lifecycle retirement rather than package deletion. Retirement MUST be enforced by main-process task and child-run entry points.

#### Scenario: Start work with a retired Agent

- **WHEN** a UI, IPC caller or child Agent attempts to create a new run for a retired Agent
- **THEN** the main process rejects the request with a retired-agent error
- **AND** existing task snapshots remain readable

### Requirement: Runtime Agent revisions are auditable and reversible

KnowMe MUST save immutable revisions for successful create, update, retire, restore and rollback actions.

#### Scenario: Roll back an Agent definition

- **WHEN** the user previews and approves rollback to a prior revision
- **THEN** KnowMe republishes that definition as a new current revision
- **AND** does not erase the intervening revision history

### Requirement: Agent operations are reusable platform tools

KnowMe MUST expose Agent verification, preview, commit and revision listing through governed tools that can be bound to the partner or the Capability Governance expert.

#### Scenario: Capability Governance expert proposes a new Agent

- **WHEN** the Capability Governance expert calls the verification and preview tools
- **THEN** it receives bounded issues, warnings, risk and the opaque change token
- **AND** no mutation occurs until the host approval gate authorizes commit

### Requirement: Expert creation starts as a structured draft

KnowMe MUST let the user define the stable responsibility, use cases, boundaries, inputs and outputs before advanced Agent tuning. Saving this form MUST persist a draft and MUST NOT publish an Agent.

#### Scenario: Save a new expert draft

- **WHEN** the user completes the required structural attributes and chooses save-and-tune
- **THEN** KnowMe stores the draft under runtime user data
- **AND** creates a Capability Governance collaboration task that references the draft id
- **AND** opens that task in the existing expert collaboration room

### Requirement: Capability Governance separates tuning from publication

The Capability Governance expert MUST read and update the referenced draft, classify Agent versus Skill or workflow, and keep definition validation distinct from real debugging and professional qualification.

#### Scenario: Tune a draft without publication

- **WHEN** Capability Governance updates a draft or verifies its definition
- **THEN** no runtime Agent package or immutable revision is published
- **AND** publication still requires a fresh preview, explicit user confirmation and host approval

### Requirement: DeepEval-based runtime evaluation

KnowMe SHALL let Capability Governance save version-bound evaluation suites and evaluate real Agent observations using DeepEval-compatible end-to-end and component metrics.

#### Scenario: Run deterministic evaluation without DeepEval

- **WHEN** a suite uses text assertions, expected tool calls, or tool permission policies
- **THEN** KnowMe evaluates them locally without a judge model and stores an immutable local report

#### Scenario: Run semantic evaluation with DeepEval

- **WHEN** the user approves an evaluation containing G-Eval, relevance, faithfulness, hallucination, or argument-correctness metrics and a supported local DeepEval runtime is available
- **THEN** a fixed bridge invokes only allowlisted metrics, uses credentials from the local environment, and stores scores and reasons locally

#### Scenario: DeepEval runtime is missing

- **WHEN** semantic metrics are requested but Python or DeepEval is unavailable
- **THEN** those metrics are blocked without fabricated scores, while the system reports an actionable setup state

#### Scenario: User installs the evaluation runtime

- **WHEN** the user explicitly approves DeepEval setup
- **THEN** KnowMe installs it into an isolated user-data environment without editing source code or the system Python installation

#### Scenario: Regression result is interpreted safely

- **WHEN** all required metrics pass across two normal plus edge, retry, revision, and reopen cases for the same definition hash
- **THEN** the report may pass the scenario-regression gate but MUST NOT claim independent professional certification
