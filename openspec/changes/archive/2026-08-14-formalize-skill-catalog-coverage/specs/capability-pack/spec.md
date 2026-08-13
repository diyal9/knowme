# capability-pack Delta

## ADDED Requirements

### Requirement: Default bundled packs include office-partner

系统 MUST 在首次启动或迁移时默认启用 `game-studio` 与 `office-partner` 能力包。

#### Scenario: Fresh install enables both packs

- **GIVEN** 用户数据区无 pack store 条目
- **WHEN** 应用启动并执行 `ensureDefaultPacks`
- **THEN** `game-studio` 与 `office-partner` MUST 均为 enabled
- **AND** `writing-polish` MUST 经 `office-partner` pack 出现在 skill runtime

#### Scenario: Office skills belong to office-partner pack

- **GIVEN** `office-partner` 已启用
- **WHEN** 列出 pack skill sources
- **THEN** 飞书与办公文档 Skill（含 `feishu-today-priority`）的 `ownerPackId` MUST 为 `office-partner`
- **AND** MUST NOT 仍归属 `game-studio`

### Requirement: Catalog root uses realpath boundary

Pack runtime MUST 使用 `realpathSync` 解析 `trustedCatalogRoot`，避免 symlink 路径导致 `catalog_outside_boundary`。

#### Scenario: Pack loads skills from symlinked repo root

- **GIVEN** 仓库 realpath 为 `sticky-notes` 而工作目录为 `knowme`
- **WHEN** 启用 bundled pack 并校验 skill refs
- **THEN** MUST NOT 因 catalog 路径分叉而安装失败
