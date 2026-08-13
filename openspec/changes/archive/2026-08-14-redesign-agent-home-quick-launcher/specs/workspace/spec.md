## ADDED Requirements

### Requirement: Agent home keeps a stable recommendation hierarchy

Agent 空状态 MUST 最多展示四张推荐任务卡，并 MUST 将工作流启动入口与一次性任务卡分层展示。未进入推荐区的动态 Skill MUST 仍可从快捷命令面板发现和执行。

#### Scenario: Dynamic skills do not overflow the recommendation grid

- **GIVEN** 当前模式存在超过四个可用于空状态的任务
- **WHEN** 用户打开无消息的 Agent 首页
- **THEN** 首页 MUST 只展示四张推荐任务卡
- **AND** 任务卡 MUST 保持完整 2×2 布局
- **AND** 其余任务 MUST 可从快捷命令面板检索

#### Scenario: Workflow entry is visually separate

- **GIVEN** 当前能力包提供默认工作流或 intake 任务
- **WHEN** 用户查看 Agent 空状态
- **THEN** 系统 MUST 在推荐任务卡下方展示独立的“启动工作流”入口
- **AND** 该入口 MUST NOT 占用四张推荐任务卡的槽位

#### Scenario: Existing task execution remains shared

- **WHEN** 用户点击推荐任务卡或独立工作流入口
- **THEN** 系统 MUST 继续使用任务目录中对应任务的 preflight 与执行链路

## MODIFIED Requirements

### Requirement: Game studio empty state

When the `game-studio` capability pack is active, the Agent empty state MUST present exactly four Feishu-first recommended tasks in a stable 2×2 grid and MUST present requirement intake as a separate workflow entry. Additional pack Skills MUST remain discoverable through the quick command launcher instead of being appended to the recommendation grid.

#### Scenario: Game studio home recommendations

- **WHEN** user opens an empty Agent surface with the `game-studio` capability pack active
- **THEN** empty state displays “KnowMe 工作伙伴” and exactly four recommended task cards
- **AND** recommendations include document/knowledge search, meeting summary, related chats, and today priority
- **AND** left side rail buttons remain visible and unchanged

#### Scenario: Game studio workflow intake

- **WHEN** user views the game studio empty state
- **THEN** “需求梳理” is displayed as a separate “启动工作流” entry below the recommendation grid
- **AND** activating it continues to run the existing workflow intake task

#### Scenario: Extra game studio skills remain discoverable

- **GIVEN** the pack exposes more than four empty-surface tasks
- **WHEN** user searches the quick command launcher
- **THEN** the additional tasks are included in searchable results
- **AND** the empty-state recommendation grid remains limited to four cards
