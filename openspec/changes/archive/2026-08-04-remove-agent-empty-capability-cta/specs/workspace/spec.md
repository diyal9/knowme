## REMOVED Requirements

### Requirement: Agent empty state and knowledge entry

**Reason**: 空状态中的大型 Capability Hub CTA 与左侧统一能力入口重复，并干扰任务优先的信息层级。

**Migration**: 能力管理继续通过左侧“能力”入口和设置页进入；空状态只保留工作任务入口。

## ADDED Requirements

### Requirement: Agent empty state prioritizes work tasks

Agent 空状态 MUST 以任务与知识入口为主，不得显示“打开能力 Hub”卡片；工作台 SHALL 保持左侧能力、知识库与设置入口位置清晰且不得恢复独立片段库。

#### Scenario: Empty agent shows task and knowledge entry

- **WHEN** Agent 列无消息
- **THEN** 空状态以任务/知识入口为主（含知识管家模板）
- **AND** 不得显示“打开能力 Hub”卡片
- **AND** 不得仅显示单一聊天提示

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
