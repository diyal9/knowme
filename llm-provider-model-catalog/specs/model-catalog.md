# Model Catalog Specification

## Scenario: provider model selection

- **WHEN** the user opens AI settings
- **THEN** the UI MUST allow choosing a provider and model preset, or entering a custom model ID.

## Scenario: profile-aware context display

- **WHEN** a model profile is selected
- **THEN** settings and Agent Composer MUST display its context window and output budget.

## Scenario: legacy settings

- **WHEN** settings contain only the legacy endpoint and model fields
- **THEN** the runtime MUST infer a compatible profile and continue without migration failure.

## Scenario: custom compatible endpoint

- **WHEN** the user enters a custom endpoint or model
- **THEN** the system MUST preserve the custom values and use conservative defaults when no profile matches.
