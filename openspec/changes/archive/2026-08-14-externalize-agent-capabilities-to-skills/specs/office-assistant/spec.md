## ADDED Requirements

### Requirement: Existing office tasks are delivered as portable Skills

The office assistant MUST provide related chats, meeting summary, today priority, document/knowledge lookup, requirement document, office document, outline drafting and finalization through enabled standard Skill packages. Migration MUST preserve current user-visible entry names, task intent, primary preflight behavior and output contract.

#### Scenario: User opens the default office home

- **WHEN** migrated office Skills and their owning pack are enabled
- **THEN** existing Feishu office entries remain discoverable
- **AND** their titles and subtitles remain semantically equivalent to the pre-migration experience

#### Scenario: User opens writing mode

- **WHEN** migrated writing Skills are enabled and the user opens an empty writing session
- **THEN** requirement document, office document, outline drafting and finalization tasks remain available
- **AND** each task still requests material before model invocation when material is absent

### Requirement: Feishu office Skills remain grounded in host tools

Each migrated Feishu office Skill MUST declare its required deterministic host tool and connector authorization precondition. Successful output MUST remain based on actual tool evidence; Skill instructions MUST NOT replace tool execution or host grounding.

#### Scenario: Run related chats

- **WHEN** the user activates related chats with Feishu authorization ready
- **THEN** the Agent uses `feishu.related_chats` for the requested natural-day range
- **AND** the result prioritizes @mentions, response items and actionable next steps without inventing chat facts

#### Scenario: Run meeting summary

- **WHEN** the user activates meeting summary
- **THEN** the Agent first obtains meeting candidates and waits for selection before reading selected content
- **AND** a final summary is not claimed before the required meeting evidence is available

#### Scenario: Run today priority

- **WHEN** the user activates today priority
- **THEN** the Agent uses `feishu.today_priority` before ranking up to three actions
- **AND** empty facts remain clearly distinguished from real user tasks

#### Scenario: Run document and knowledge lookup

- **WHEN** the user activates document/knowledge lookup
- **THEN** the Agent uses `feishu.doc_kb_suggest` for initial candidates
- **AND** it does not read document bodies until the user selects or requests a specific item

### Requirement: Office business behavior is updateable through Skill content

Task instructions, entry copy, fixed preflight guidance, safe prompt enhancement and output formatting rules MUST be sourced from installed Skill/Pack content. Updating those business-level fields MUST affect subsequent runs without modifying KnowMe core source.

#### Scenario: Related chats output format is updated

- **WHEN** the related chats Skill is updated with a valid revised output contract
- **THEN** subsequent activations follow the revised contract while still using the same host tool and grounding controls

#### Scenario: Core-only change is required

- **WHEN** a requested capability needs a new executable tool, permission type or UI primitive not supported by the host
- **THEN** Skill validation reports the unsupported dependency
- **AND** the Skill MUST NOT simulate the missing core capability
