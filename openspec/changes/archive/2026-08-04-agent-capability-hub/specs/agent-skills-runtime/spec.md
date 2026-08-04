# Delta Spec: agent-skills-runtime

## Purpose

为 KnowMe Agent 提供与 agentskills.io、Claude Code、Cursor 兼容的 SKILL.md 技能运行时，支持三级渐进披露、标准 Agent tools，以及与旧 OKF slash skill 的双轨迁移。

## ADDED Requirements

### Requirement: SKILL.md package layout compatibility

已安装技能 MUST 遵循 `skills/<id>/SKILL.md` 布局，可选 `references/`、`scripts/`、`assets/` 子目录。SKILL.md frontmatter MUST 支持 `name`、`description`、`disable-model-invocation`（boolean）。

#### Scenario: Parse standard skill package

- **WHEN** 安装来自 Cursor/Claude Code 的标准技能目录
- **THEN** 系统解析 frontmatter 与 body，并在 Hub 显示 name 与 description

#### Scenario: Reject missing SKILL.md

- **WHEN** 导入目录不含 SKILL.md
- **THEN** 安装失败并提示缺少必需文件

### Requirement: Three-tier progressive disclosure via skill tools

Agent MUST 提供四个 skill tools：`list_skills`、`load_skill`、`read_skill_resource`、`run_skill_script`。披露层级 MUST 为：L0 元数据 → L1 SKILL.md body → L2 references/assets → L3 scripts。

#### Scenario: list_skills returns metadata only

- **WHEN** 模型调用 `list_skills`
- **THEN** 返回所有 enabled 技能的 id、name、description（及 disable-model-invocation 标记）
- **AND** MUST NOT 包含 SKILL.md 正文或 scripts 内容

#### Scenario: load_skill returns body within budget

- **WHEN** 模型调用 `load_skill` 并指定 skill id
- **THEN** 返回 SKILL.md 正文（超预算时截断并标注）

#### Scenario: read_skill_resource returns single file

- **WHEN** 模型调用 `read_skill_resource` 指定 skill id 与相对路径
- **THEN** 返回 references/ 或 assets/ 下单文件内容
- **AND** 路径 MUST 限制在该 skill 目录内

#### Scenario: run_skill_script executes via sandbox

- **WHEN** 模型调用 `run_skill_script` 指定 script 相对路径与参数
- **THEN** 在 skill 沙箱工作区内执行 scripts/ 下脚本
- **AND** 受 run 级 permissions 与超时/输出上限约束

### Requirement: Automatic and manual skill triggering

系统 MUST 支持两种触发：(1) 基于 description 的本地自动匹配，向 context 注入 L0 摘要；(2) 用户输入 `/` 的手动 slash 选择，注入 L1 body。

#### Scenario: Auto-match injects L0 summaries

- **WHEN** 用户发送消息且未显式 `/slash`
- **THEN** 系统对 enabled 技能 description 做本地匹配（无网络）
- **AND** top-K 命中技能的 L0 摘要并入 agent-context-assembly

#### Scenario: Slash picker merges skill sources

- **WHEN** 用户在 Agent 输入框输入 `/`
- **THEN** 展示可过滤列表，含 SKILL.md 技能与旧 OKF slash 技能
- **AND** 选择后将对应正文注入本轮 context

#### Scenario: disable-model-invocation blocks auto-match

- **WHEN** 技能 frontmatter 含 `disable-model-invocation: true`
- **THEN** 该技能 MUST NOT 出现在自动匹配结果中
- **AND** 仅 `/slash` 或 UI 显式选用时可加载

### Requirement: Legacy OKF slash skill dual-track migration

旧 OKF slash 技能 MUST 继续可用（双轨）。Hub MUST 展示 legacy 条目并提供导出为标准 SKILL.md 到 capabilities 的能力。

#### Scenario: Legacy slash still injects

- **WHEN** 用户选择旧 OKF slash 命令
- **THEN** 行为与改造前一致，正文注入动态 context

#### Scenario: Export legacy to SKILL.md

- **WHEN** 用户在 Hub 对 legacy 技能点击「迁移为标准技能」
- **THEN** 生成 `capabilities/skills/<id>/SKILL.md` 并保留原 OKF 只读
- **AND** 新 SKILL 出现在 Hub 技能列表

### Requirement: Skill lifecycle tied to install store

技能的 enabled/disabled/uninstalled 状态 MUST 与 capability install store 同步。disabled 技能 MUST NOT 出现在 list_skills 与 slash picker。

#### Scenario: Disabled skill hidden from agent

- **WHEN** 用户在 Hub 禁用某技能
- **THEN** 后续 Agent run 的 list_skills 与自动匹配均不含该技能
