# agent-skills-runtime Specification

## Purpose

为 KnowMe Agent 提供与 agentskills.io、Claude Code、Cursor 兼容的 SKILL.md 技能运行时，支持三级渐进披露、标准 Agent tools，以及与旧 OKF slash skill 的双轨迁移。
## Requirements
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

### Requirement: Runtime loads registered linked skills
Agent Skills Runtime MUST 将已启用的 Cursor 仓库技能与已复制到 capabilities 的标准技能合并为同一技能列表，并从注册来源读取技能内容。

#### Scenario: Linked skill appears in picker
- **WHEN** Cursor 仓库技能已注册且启用
- **THEN** 技能选择器与自动匹配可发现该技能
- **AND** L0 元数据来自其 SKILL.md

#### Scenario: Linked skill is disabled
- **WHEN** 用户在 Hub 禁用已注册仓库技能
- **THEN** 技能选择器、自动匹配和工具调用不再提供该技能

### Requirement: Linked resources and scripts remain repository-confined
运行时 MUST 以技能目录和仓库根目录双重边界解析链接技能资源；资源读取仅允许现有资源目录，脚本执行仅允许技能 `scripts/` 且 MUST 经过 sandbox 权限。

#### Scenario: Read repository-linked reference
- **WHEN** Agent 请求已注册技能的 `references/example.md`
- **THEN** 运行时读取原仓库技能目录中的对应文件

#### Scenario: Linked path escapes repository
- **WHEN** 注册元数据或资源请求解析到仓库根目录之外
- **THEN** 运行时拒绝加载并返回非法路径错误

### Requirement: Missing linked source degrades honestly
链接技能来源不存在、不是目录或不再包含 SKILL.md 时，运行时 MUST 将其视为不可用，不得回退到过期内容或伪造成功。

#### Scenario: Repository was moved
- **WHEN** 已注册技能的来源目录无法访问
- **THEN** 技能不进入可执行列表
- **AND** Hub 可显示来源丢失状态

### Requirement: Skill runtime exposes unified declaration metadata

标准、legacy OKF 与 Cursor linked Skill MUST 在运行时映射为统一声明，并在 L0 元数据中提供依赖、权限、输入输出、风险与 provenance；L1–L3 内容和执行边界 MUST 保持不变。

#### Scenario: Linked skill has sidecar metadata

- **WHEN** 已注册 linked Skill 含合法 v2 sidecar
- **THEN** L0 SHALL 使用 sidecar 治理元数据和 SKILL.md 展示内容
- **AND** 资源与脚本仍受仓库和技能目录双重约束

#### Scenario: Legacy skill lacks sidecar

- **WHEN** SKILL.md 不含 v2 sidecar
- **THEN** runtime SHALL 使用 adapter 返回兼容统一声明
- **AND** 技能仍可按原方式自动匹配和 slash 加载

### Requirement: Skill and workflow declare grounding contract

SKILL.md frontmatter 与 Workflow manifest MUST 支持可选字段：`requiredTools`、`requiredEvidence`、`completionConditions`。Runtime 激活 skill/workflow 时 MUST 写入 ReferenceState.taskFrame 并强制执行。

#### Scenario: Required tool enforced at runtime

- **WHEN** skill 声明 `requiredTools: [feishu.meeting_read]`
- **AND** 用户完成结构化选择触发读取流程
- **THEN** runtime MUST 调度该 tool 或 fail-closed
- **AND** MUST NOT 仅依赖 skill body 中的自然语言说明

#### Scenario: Required evidence blocks completion

- **WHEN** `requiredEvidence` 要求 tool_result minChars 且 forbidTruncated
- **AND** 工具返回 truncated/empty
- **THEN** completionConditions MUST NOT 满足
- **AND** skill 不得标记 workflow 完成

#### Scenario: Missing contract keeps legacy behavior

- **WHEN** skill 未声明 grounding 三元组
- **THEN** runtime MUST 保持与改造前等价的宽松行为
- **AND** 不得因缺字段而阻断 unrelated chat

### Requirement: Workflow writes structured refs not NL recovery hints

Skill/Workflow 触发的候选列表（会议、文档、任务等）MUST 通过 ReferenceState pendingSelection 或 refs 写入结构化 payload，MUST NOT 仅依赖助手 Markdown 里的「回复 1/2」文本供下轮 NL 解析。

#### Scenario: Meeting workflow seeds pending selection

- **WHEN** workflow 展示 N 个候选条目
- **THEN** 系统 MUST 写入 pendingSelection.options 含 id、label、payload
- **AND** UI 卡片与 ReferenceState MUST 一致

### Requirement: Skill references in Agent Profile snapshots

Agent Profile 和 Workflow Package MUST 保存所启用 Skill 的版本、内容哈希、治理摘要和触发方式；运行时 MUST 根据快照解析 Skill，不得静默使用当前目录中的不同版本。

#### Scenario: Snapshot enabled skills

- **WHEN** 用户保存 Agent Profile 或确认工作流
- **THEN** 系统保存每个启用 Skill 的版本、哈希和权限摘要

#### Scenario: Skill version drift

- **WHEN** 历史工作流引用的 Skill 当前版本发生变化
- **THEN** 系统提示版本漂移，并要求用户确认升级或继续使用历史快照

### Requirement: Skill availability in workflow validation

Graph 或 Workflow Package 校验 MUST 检查每个 Skill 的 enabled 状态、依赖、风险和执行权限；不满足条件时 MUST fail closed。

#### Scenario: Disabled skill blocks run

- **WHEN** 工作流引用已禁用 Skill
- **THEN** 校验失败并指出对应 Agent 和 Skill，且不创建 Run

#### Scenario: Skill risk requires gate

- **WHEN** 工作流启用需要审批的高风险 Skill
- **THEN** 工作流预览显示审批 Gate，未经确认不得执行副作用操作

