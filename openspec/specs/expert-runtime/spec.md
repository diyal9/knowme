# expert-runtime Specification

## Purpose

为 KnowMe Agent 提供可安装、可编辑的专家（Expert）运行时，通过 EXPERT.md 定义 persona，绑定 skills 与 connectors，并在 Session 级冻结能力版本快照。
## Requirements
### Requirement: EXPERT.md manifest defines expert persona

专家包 MUST 位于 `experts/<id>/`，含 `EXPERT.md`（frontmatter: name, description, avatar, skills[], connectors[], systemPrompt）及 `manifest.json`（version, contentHash）。

#### Scenario: Install expert from curated catalog

- **WHEN** 用户从 Hub 安装精选专家
- **THEN** 专家目录写入 capabilities/experts/
- **AND** Hub 卡片显示专家名称、描述与头像

#### Scenario: Reject invalid expert package

- **WHEN** EXPERT.md 缺少 name 或 systemPrompt
- **THEN** 安装失败并提示校验错误

### Requirement: Expert binds skills and connectors

专家 manifest MUST 声明绑定的 skill id 列表与 connector id 列表。Agent 在该专家激活时 MUST 仅暴露绑定且 enabled 的技能与连接器工具（受 allowlist 约束）。

#### Scenario: Bound skills available

- **WHEN** Session 激活某专家且专家绑定 skill A
- **THEN** skill A 参与自动匹配与 list_skills（若 enabled）

#### Scenario: Unbound skill excluded

- **WHEN** Session 激活专家 X 且 skill B 未在 X 的 bindings 中
- **THEN** 即使用户全局 enabled skill B，专家 Session 中 B 不参与装配

### Requirement: Session freezes capability version snapshot

新建或切换 Session 且绑定 expertId 时，系统 MUST 拷贝当前 expert 及其绑定 skills/connectors 的 manifest hash 到 `snapshots/<sessionId>/`。后续该 Session 的对话 MUST 使用快照版本，Hub 内对 expert 的更新 MUST NOT 影响已打开 Session。

#### Scenario: Snapshot on session create

- **WHEN** 用户新建 Session 并选择专家「写作教练」
- **THEN** 系统写入 snapshots/<sessionId>/manifest.json 含 expert 与绑定能力 hash

#### Scenario: Hub update does not drift open session

- **WHEN** 用户编辑「写作教练」systemPrompt 并保存
- **AND** 已有 Session S 在编辑前已绑定该专家
- **THEN** Session S 继续使用编辑前快照 persona
- **AND** 新建 Session 使用更新后版本

### Requirement: Expert CRUD and try-chat in Hub

Hub MUST 支持专家的创建、编辑、安装、卸载，以及抽屉内「试聊」。

#### Scenario: Create custom expert

- **WHEN** 用户通过 Hub 自定义向导创建专家
- **THEN** 生成 EXPERT.md 与 manifest 并出现在专家列表

#### Scenario: Edit expert persists

- **WHEN** 用户在 Hub 编辑专家并保存
- **THEN** 磁盘 manifest 更新且 Hub 立即反映

#### Scenario: Try-chat opens ephemeral session

- **WHEN** 用户在专家详情抽屉点击「试聊」
- **THEN** 打开标记 ephemeral 的临时 Session，绑定该专家快照
- **AND** 关闭试聊后不保留在主 Session Tab 列表

### Requirement: Expert persona injects into context assembly

激活专家的 Session MUST 将 expert systemPrompt（来自快照）注入 agent-context-assembly，优先级高于通用底座、低于用户显式 `/slash` 技能正文。

#### Scenario: Persona in assist tier

- **WHEN** Session 绑定专家且用户发送工作类消息
- **THEN** 装配 context 含专家 systemPrompt 摘要

### Requirement: Cursor repository import produces runnable experts
仓库导入生成的 Expert MUST 使用标准 Expert Runtime 数据形态，包含稳定 ID、名称、描述、system prompt、技能绑定和连接器绑定，并可创建 Session 快照。

#### Scenario: Imported Cursor agent starts trial chat
- **WHEN** 用户对由 Cursor Agent 适配的 Expert 点击“试聊专家”
- **THEN** 系统创建包含其 persona 和已注册能力绑定的临时 Session

#### Scenario: Generated repository expert starts trial chat
- **WHEN** 用户试聊由主入口技能生成的仓库级 Expert
- **THEN** Session persona 来自主入口技能
- **AND** bindings 包含该仓库已注册技能

### Requirement: Expert bindings include only registered capabilities
适配过程中不存在、无效或未注册的技能与连接器 MUST 从可执行绑定中排除，并以预览警告呈现；系统 MUST NOT 生成指向不可用能力的静默绑定。

#### Scenario: Agent declares unknown skill
- **WHEN** Cursor Agent manifest 声明仓库中不存在的技能 ID
- **THEN** 预览显示缺失绑定警告
- **AND** 最终 Expert 的可执行 bindings 不包含该 ID

### Requirement: Reimport updates future snapshots without mutating existing snapshots
重复导入仓库更新 Expert 后，新 Session MUST 使用新版本；已经冻结的 Session 快照 MUST 保持原 persona 与绑定哈希。

#### Scenario: Expert source changes after an existing session
- **WHEN** 用户重新导入已修改的 Cursor Agent
- **THEN** 新试聊使用更新后的 Expert
- **AND** 旧 Session 继续使用原快照

