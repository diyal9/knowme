# Delta Spec: slash-skill

## MODIFIED Requirements

### Requirement: Custom skill with slash

用户 MUST 能在 **Capability Hub**（技能 Tab → 自定义创建）新建技能并设置 `slash` 命令。创建入口 MUST 使用应用内表单/向导，MUST NOT 依赖 `window.prompt`（Electron 下不可用）。设置页旧入口 MAY 显示迁移 banner 跳转 Hub。

#### Scenario: Create skill in Hub

- **WHEN** 用户在 Capability Hub 技能 Tab 点击「自定义创建」
- **THEN** 打开表单可设置名称、slash 命令与 SKILL.md 正文
- **AND** 保存后写入 `%APPDATA%\KnowMe\capabilities\skills\<id>/`

#### Scenario: Legacy settings banner

- **WHEN** 用户打开设置页原技能创建入口
- **THEN** 显示「已迁移到能力 Hub」引导，仍可访问 legacy OKF 只读列表

### Requirement: Slash picker

AI 助写输入 `/` 时 MUST 展示可过滤技能列表，列表 MUST 合并 SKILL.md 技能与 legacy OKF slash 技能。

#### Scenario: Merged slash list

- **WHEN** 用户在 Agent 输入 `/`
- **THEN** picker 展示两类来源，并可按名称/slash 过滤

### Requirement: Inject referenced skills

发送含 `/slash` 的助写请求时 MUST 将该技能正文注入动态上下文。SKILL.md 技能注入 L1 body；legacy OKF 注入原有 concept 正文。

#### Scenario: Inject SKILL.md body

- **WHEN** 用户选择 SKILL.md 技能 `/summarize`
- **THEN** 本轮 context 含该 SKILL.md 正文（预算内）

## ADDED Requirements

### Requirement: Migrate legacy OKF slash to SKILL.md

Hub MUST 提供将 legacy OKF slash 技能导出为标准 SKILL.md 到 capabilities 的一键迁移。

#### Scenario: One-click migration

- **WHEN** 用户对 legacy 技能点击「迁移为标准技能」
- **THEN** 生成 capabilities/skills/ 下新包且 slash 命令保留
