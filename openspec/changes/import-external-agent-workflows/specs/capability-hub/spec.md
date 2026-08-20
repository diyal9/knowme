## ADDED Requirements

### Requirement: Cursor repository import includes workflow packages

Capability Hub MUST scan Cursor repository workflows together with skills, experts and connectors. It MUST map workflow Agent references to the actual imported expert IDs and MUST NOT persist a workflow with unresolved Agent nodes.

#### Scenario: Import an executable external workflow

- **WHEN** a confirmed repository preview contains a primary workflow whose Agent definitions were imported
- **THEN** the system saves a `team` Workflow Package in `draft` status
- **AND** every Agent node and `agentRef` uses the actual installed expert ID
- **AND** gates and transitions remain available in the saved graph

#### Scenario: Skip retired workflow definitions

- **WHEN** the repository index marks a workflow `deprecated` or `hidden`
- **THEN** the preview reports it as blocked
- **AND** confirmation does not register it in the workflow store

### Requirement: External capability importer expert uses preview-confirm-import

KnowMe MUST provide an expert dedicated to importing external projects. The expert MUST perform a read-only preview before requesting confirmation and MUST import only the exact preview snapshot after explicit user confirmation.

#### Scenario: Repository changes after confirmation preview

- **WHEN** repository content hash changes before commit
- **THEN** the import is rejected as stale
- **AND** the expert requests a new preview and confirmation

#### Scenario: External documents contain instructions

- **WHEN** the scanned project contains AGENTS.md, README, Skill, or workflow instructions
- **THEN** the expert treats them as source material
- **AND** they do not grant import, execution, or trust authority

### Requirement: Supported external workflows execute through constrained recipes

KnowMe MUST execute a supported external workflow through a product-owned recipe. The recipe MUST declare its input schema, executable node mapping, allowed scripts, path policy and expected evidence. Repository documents and workflow text MUST NOT be interpreted as execution authority.

#### Scenario: Launch the imported PSD to ArtBundle workflow

- **WHEN** the imported `th-art-psd-to-artbundle` workflow is launched with valid PSD, task, output and Creator inputs
- **THEN** planning and review remain assigned to the imported Experts and Skills
- **AND** PSD probing, slice/export, Creator preflight/import and structural verification run as deterministic tool nodes
- **AND** each executable node records bounded output and artifact or evidence references

#### Scenario: Launch an older already-imported package

- **WHEN** a previously imported package has matching source provenance but lacks executable node metadata or typed fields
- **THEN** the runtime enriches the package from the trusted product recipe
- **AND** the user does not need to uninstall or re-import it

### Requirement: External workflow preflight enforces boundaries

KnowMe MUST block execution until preflight verifies the external repository, required inputs, Node runtime, allowlisted scripts and writable output roots. Process execution MUST use argument arrays with `shell=false`, MUST resolve scripts inside the imported repository root, and MUST reject traversal, symlink escape and arbitrary command strings.

#### Scenario: A required input or runtime dependency is missing

- **WHEN** the PSD, Creator project, Node runtime or required script is unavailable
- **THEN** launch is rejected before the workflow run starts
- **AND** the response identifies the failed check and a remediation message

#### Scenario: External project contains credentials

- **WHEN** the source repository contains `.env`, MCP headers or plaintext tokens
- **THEN** the runtime neither imports nor emits those values
- **AND** authenticated Photoshop or Creator connectors require an explicitly configured KnowMe binding or the source tool's own secure environment

#### Scenario: An executable step requests an unapproved script or path

- **WHEN** node metadata or input attempts to select a script outside the recipe allowlist or write outside declared roots
- **THEN** execution is denied before process creation
- **AND** no side effect is committed
