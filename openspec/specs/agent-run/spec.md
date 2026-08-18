# Spec: Agent Run

## Purpose

将「一次任务」建模为 Run：目标、角色、工具轨迹与可审阅产物；兼容既有 Session Tab，对话降级为 trace。

## Requirements

### Requirement: Session-compatible Run metadata

Run 元数据 MUST 可附着于既有 Session（或等价关联存储）；缺少 `run` 字段的旧 Session MUST 仍可正常打开与聊天。

#### Scenario: Legacy session opens

- **WHEN** 用户打开无 `run` 字段的旧 Session
- **THEN** Tab 与 transcript 行为与升级前一致，不报错

#### Scenario: Persist run goal

- **WHEN** 用户从任务模板或显式设置填写 goal 并开始
- **THEN** `run.goal` / `run.role` / `run.status` 持久化，重启后可恢复

### Requirement: Artifacts as first-class outputs

Run MUST 支持 `artifacts` 列表；知识类与需人审的产物 MUST 以**右栏 Work Surface 审阅**为主要操作面；transcript MUST 展示摘要卡（含打开入口），不得仅依赖气泡内完成接受/拒绝作为唯一路径。

#### Scenario: Show artifact summary in transcript

- **WHEN** Run 产生 `knowledge_proposal`、`health_report` 或 `editor_patch` draft
- **THEN** transcript 展示产物摘要卡（标题、短摘要、「在右侧打开」），完整审阅在右栏

#### Scenario: Accept from work surface

- **WHEN** 用户在右栏审阅面点击接受且产物含合法 `targetPath`（知识类）
- **THEN** 主进程写入目标文件，产物状态变为 `accepted`，并 toast 成功

#### Scenario: Reject from work surface

- **WHEN** 用户在右栏拒绝产物
- **THEN** 状态变为 `rejected`，磁盘不被该产物修改

#### Scenario: Bubble actions remain secondary

- **WHEN** 助手文本气泡展示
- **THEN** 气泡仅提供「复制」等轻量动作；文件写入须通过产物卡（`editor_patch`）人审；审阅类主路径仍在右栏

### Requirement: Draft opens review surface

新增 `draft` Artifact 时，系统 SHOULD 自动将右栏切至 `review`（见 `work-surface`）；用户关闭审阅后 MUST 仍可从摘要卡重新打开。

#### Scenario: Auto open on first draft

- **WHEN** 本轮首次产生待审 draft Artifact
- **THEN** 右栏进入 `review` 并展示该产物

### Requirement: File write via artifact only

对普通文本助手回复，系统 MUST NOT 在气泡内提供「应用到文件」入口。写入当前编辑器的能力 MUST 通过 `editor_patch` 产物卡人审；高风险「替换全文」MUST 经确认或 `editor_patch` 授权，不得静默一键覆盖。

#### Scenario: Write via artifact card

- **WHEN** 助手文本回复需写入活动文件
- **THEN** 用户通过产物卡接受 `editor_patch` draft 后写入；气泡内无「应用到文件」菜单

### Requirement: Tools used recorded

成功调用的知识工具 MUST 记入 `run.toolsUsed`（去重或按序），供 UI 或调试展示。

#### Scenario: Lint records tool

- **WHEN** 本 Run 执行了 `wiki.lint`
- **THEN** `toolsUsed` 包含 `wiki.lint`

### Requirement: editor_patch artifact type

Run 产物类型 MUST 支持 `editor_patch`，用于对话侧「写当前编辑器」的待授权提案。

#### Scenario: Normalize editor_patch

- **WHEN** 添加 `type: editor_patch` 的产物
- **THEN** 规范化后类型保留为 `editor_patch`，默认 status 为 `draft`

#### Scenario: Accept does not write knowledge disk

- **WHEN** 用户接受 `editor_patch`
- **THEN** 主进程 MUST NOT 将其当作知识库路径写入；由渲染进程应用到活动编辑器

### Requirement: Apply operation log

Run MUST 可记录近期写操作轨迹（如插入/追加/替换/拒绝），供 UI 或调试展示。

#### Scenario: Record after insert

- **WHEN** 用户成功插入助手文本到编辑器
- **THEN** `run.applyLog`（或等价字段）增加一条含动作类型与时间的记录
