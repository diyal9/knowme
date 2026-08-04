# Spec Delta: game-requirement-doc

## ADDED Requirements

### Requirement: Structured game requirement sections

A game requirement document MUST include sections: background, goals, gameplay, acceptance; MAY include rules, economy, analytics, risks.

#### Scenario: Validation blocks approval

- **WHEN** required sections are empty
- **THEN** approve returns ok=false with missing section keys

### Requirement: Feishu draft approval path

Writing to Feishu MUST go through artifact approval; `allowFeishuDraft` on requirement artifacts MUST NOT bypass existing write-review IPC.

#### Scenario: Artifact meta

- **WHEN** a complete requirement is approved
- **THEN** artifact meta includes `workspaceAction: game_requirement_review` and `allowFeishuDraft: true`
