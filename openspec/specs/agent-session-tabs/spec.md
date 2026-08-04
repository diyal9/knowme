# agent-session-tabs Specification

## Purpose

定义 Agent 多 Session Tab 的创建、切换、管理、持久化与隔离行为，并支持专家绑定和 Session 级能力快照。

## Requirements

### Requirement: Session tab chrome

Agent 模式顶栏 MUST 提供可滚动的 Session Tab 列表与右侧工具群，并确保每个 Tab 的激活状态、transcript 和草稿彼此隔离。

#### Scenario: Agent mode shows tab chrome

- **WHEN** 用户进入 Agent 模式
- **THEN** 顶栏从左到右展示可滚动的 Session Tab 列表与右侧工具群（`+` / 历史 / ⋯）
- **AND** 不再展示左侧「New Agent」独立按钮

#### Scenario: Active tab is identifiable

- **WHEN** 某 Session 为当前激活 Tab
- **THEN** 该 Tab 呈现激活样式，并显示关闭 `×`

#### Scenario: Switching tab restores isolated state

- **WHEN** 用户点击非激活 Tab
- **THEN** 切换到该 Session 的 transcript
- **AND** 输入框草稿按 Session 恢复，不与其他 Tab 串线

### Requirement: Session creation and closing

工作台 MUST 支持从顶栏创建和关闭 Session，并在无打开 Session 时保证始终有一个可用的空白 Session。

#### Scenario: Create a blank session

- **WHEN** 用户点击右侧 `+`
- **THEN** 创建全新空白 Session，加入打开 Tab 并激活
- **AND** 其他 Tab 的历史消息保持不变

#### Scenario: Ensure one session exists

- **WHEN** 用户打开工作台且没有任何 Session，或打开 Tab 集合为空
- **THEN** 自动创建并激活一条空白 Session

#### Scenario: Close a tab without deleting session

- **WHEN** 用户点击 Tab 上的 `×`
- **THEN** 该 Session 从打开 Tab 移除，但磁盘中的 Session 数据仍保留
- **AND** 若关闭的是激活 Tab，则激活相邻 Tab；若无相邻 Tab 则自动新建一个

### Requirement: Session history

工作台 MUST 提供最近 Session 历史列表，并允许重新打开未处于 Tab 栏的 Session。

#### Scenario: Show recent sessions

- **WHEN** 用户点击时钟（历史）图标
- **THEN** 展示最近 Session 列表（含标题与时间）

#### Scenario: Reopen a historical session

- **WHEN** 用户从历史中选择一个未打开的 Session
- **THEN** 将其加入打开 Tab 并激活

### Requirement: Tab context menu

每个 Session Tab MUST 提供右键菜单，支持管理对话、复制 transcript 与持久化 Pin 状态。

#### Scenario: Open tab context menu

- **WHEN** 用户在 Session Tab 上右键
- **THEN** 弹出菜单，至少包含管理对话、复制 Transcript、Pin
- **AND** 已 Pin 时显示取消 Pin

#### Scenario: Manage conversation from tab

- **WHEN** 用户选择「管理对话」
- **THEN** 激活该 Session，并打开与 ⋯ 相同的管理菜单

#### Scenario: Copy transcript

- **WHEN** 用户选择「复制 Transcript」
- **THEN** 将该 Session 的完整对话（用户/助手轮次）写入剪贴板

#### Scenario: Pin session

- **WHEN** 用户选择「Pin」
- **THEN** 将该 Session 标记为 pinned 并持久化
- **AND** 在打开 Tab 列表中靠前展示且带 Pin 标识

#### Scenario: Unpin session

- **WHEN** 用户选择「取消 Pin」
- **THEN** 清除 pinned 标记并更新 Tab 排序与标识

### Requirement: Active session management menu

当前激活 Session MUST 提供 ⋯ 管理菜单，支持复制总结、续开新 Agent、重命名、关闭 Tab 和复制错误信息。

#### Scenario: Open active session menu

- **WHEN** 用户点击 ⋯
- **THEN** 弹出针对当前激活 Session 的菜单，至少包含复制当前总结、在新 Agent 继续、重命名、关闭 Tab、复制错误信息
- **AND** 无错误时复制错误信息禁用

#### Scenario: Copy current summary

- **WHEN** 用户选择「复制当前总结」
- **THEN** 将当前 Session 的 summary 写入剪贴板
- **AND** 若无 summary 则由最近消息生成

#### Scenario: Continue in new agent

- **WHEN** 用户选择「在新 Agent 继续」
- **THEN** 新建 Session，把当前总结写入新 Session 的 summary，打开为新 Tab 并激活
- **AND** 原 Session 保持不变

#### Scenario: Rename session inline

- **WHEN** 用户选择「重命名」
- **THEN** 可在 Tab 内联修改标题，并持久化到 Session.title

### Requirement: Session persistence and isolation

工作台 MUST 持久化打开与激活 Session 状态，并保证 AI 请求仅使用当前激活 Session 的上下文。

#### Scenario: Restart restores open sessions

- **WHEN** 用户重启工作台
- **THEN** 恢复 `openSessionIds` 与 `activeSessionId`
- **AND** 各 Session 消息互不合并

#### Scenario: Request uses active session context

- **WHEN** 发送 AI 请求
- **THEN** 仅绑定当前激活 Session 的上下文

### Requirement: Session copy and visual conventions

Session Tab MUST 使用稳定的默认标题与工作台浅色 chrome，并避免以角色胶囊替代 Session 主切换。

#### Scenario: Empty tab has a default title

- **WHEN** Tab 无自定义标题且消息为空
- **THEN** 默认显示「New Agent」
- **AND** 若存在 `run.goal` 可用其截断作为展示标题

#### Scenario: Render workbench chrome

- **WHEN** 渲染顶栏
- **THEN** 使用工作台浅色 chrome
- **AND** 不以「通用 / 写作 / 编程」胶囊作为主切换

### Requirement: Run metadata compatibility

Session Tab MUST 兼容包含或不包含 `run` / `artifacts` 字段的历史 Session，且不得导致 transcript 或产物跨 Session 串线。

#### Scenario: Session with run metadata remains isolated

- **WHEN** Session 含 `run` / `artifacts` 字段
- **THEN** Tab 切换、关闭、历史、⋯ 菜单行为与升级前一致
- **AND** transcript 与产物卡不串线

#### Scenario: Legacy session without run metadata opens

- **WHEN** 旧 Session 无 `run` 字段
- **THEN** 仍可正常打开与聊天

### Requirement: Session binds expert and capability snapshot

Session 数据 MUST 支持 `expertId` 与 `capabilitySnapshotId`（或等价 snapshots 路径）。新建 Session 时 MAY 选择专家；选择后 MUST 冻结 capability 版本快照。

#### Scenario: New session with expert picker

- **WHEN** 用户点击 `+` 新建 Session
- **THEN** MAY 弹出专家选择（可跳过为通用 Agent）
- **AND** 选择专家后写入 expertId 并创建 snapshot

#### Scenario: Tab shows expert indicator

- **WHEN** Session 绑定专家
- **THEN** Tab 标题或副标展示专家名称

#### Scenario: Snapshot survives tab switch

- **WHEN** 用户在多 Tab 间切换
- **THEN** 各 Session 使用各自 snapshot，expert persona 与工具集不串线

### Requirement: Ephemeral try-chat sessions excluded from main tabs

专家 Hub「试聊」产生的 ephemeral Session MUST NOT 出现在常开 Tab 列表；关闭试聊 MUST 清理 ephemeral 数据。

#### Scenario: Try-chat not in tab bar

- **WHEN** 用户从 Hub 试聊专家
- **THEN** 试聊 UI 独立展示，主 Tab 栏不新增持久 Tab

### Requirement: Persistence includes expert binding

Session 持久化 MUST 包含 `expertId` 与 snapshot 引用；重启后 MUST 恢复 openSessionIds、activeSessionId 与各 Session 的专家绑定。

#### Scenario: Restart restores expert session

- **WHEN** 用户重启工作台
- **THEN** 恢复 openSessionIds、activeSessionId 与各 Session 的 expertId 与 snapshot 引用

#### Scenario: Restart keeps snapshot persona

- **WHEN** 重启前 Session S 绑定专家且存在 snapshot
- **THEN** 重启后 Session S 继续使用同一 snapshot persona
