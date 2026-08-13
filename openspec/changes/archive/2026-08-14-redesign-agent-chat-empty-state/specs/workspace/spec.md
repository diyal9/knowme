## MODIFIED Requirements

### Requirement: Agent empty state prioritizes work tasks

Agent 空状态 MUST 以“描述任务并开始”为首要动作，在同一聚焦启动区域展示真实 Composer 和最多四个任务/知识入口；不得显示“打开能力 Hub”卡片。工作台 SHALL 保持左侧能力、知识库与设置入口位置清晰且不得恢复独立片段库。

#### Scenario: Empty agent shows composer and task entries

- **WHEN** Agent 列无消息且无产物
- **THEN** 空状态 MUST 先展示可直接发送的 Composer，再展示最多四个任务/知识入口
- **AND** 不得显示“打开能力 Hub”卡片
- **AND** 不得仅显示单一聊天提示

#### Scenario: First message restores conversation layout

- **WHEN** 用户从空状态发送首条消息
- **THEN** 空状态启动内容 MUST 退出
- **AND** Composer MUST 回到底部固定区域
- **AND** 消息列表 MUST 使用其余可用高度

#### Scenario: Open knowledge panel from ribbon

- **WHEN** 用户点击左侧 ribbon 底部“知识库”
- **THEN** 打开知识面板（见 `knowledge-os`）

#### Scenario: Open settings from ribbon

- **WHEN** 用户点击左侧 ribbon 底部“设置”
- **THEN** 打开设置窗口

#### Scenario: Open capability hub from unified rail entry

- **WHEN** 用户点击左侧 rail“能力”入口
- **THEN** 打开统一 Capability Hub

#### Scenario: Knowledge controls remain in designated locations

- **WHEN** 工作台渲染 Agent 顶栏、文件树底栏与设置页知识库管理
- **THEN** Agent 对话顶栏 MUST NOT 放置知识面板按钮
- **AND** 文件树底栏 MUST NOT 放置知识库、设置或片段库
- **AND** 设置页知识库管理保留，文案 MAY 引导至工作台知识库入口
- **AND** 工作台 MUST NOT 提供独立“片段库”入口或 snippets IPC
