# official-workflows Delta

## MODIFIED Requirements

### Requirement: Official workflow skillRefs resolve to bundled skills

官方参考工作流的 `skillRefs` MUST 指向 bundled catalog 中可 `loadSkillL1` 的技能。

#### Scenario: Engineering delivery references code-review

- **GIVEN** `official-engineering-team-delivery` 工作流
- **WHEN** 解析 skillRefs
- **THEN** `code-review` MUST 存在于 enabled pack 或 catalog 且可加载

#### Scenario: Visual brief review uses bundled visual skill

- **GIVEN** `official-visual-brief-review` 工作流
- **WHEN** 解析 skillRefs
- **THEN** MUST 包含 bundled `visual-brief-prompt`（或等效官方视觉 Skill）
- **AND** MUST NOT 依赖已卸载的 Cursor 仓库技能
