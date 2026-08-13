## ADDED Requirements

### Requirement: Empty state prioritizes Feishu connection shortcuts

当 `game-studio` 能力包已启用时，助手空状态 MUST 展示以飞书连接为主的快捷入口，而不是默认展示策划 / 研发 / 测试 / 制作角色卡。空状态 MUST 至少包含：查文档/知识库、会议总结、相关聊天、需求梳理（工作流 intake）。

#### Scenario: Pack empty state shows connector cards

- **WHEN** `game-studio` 已启用且用户打开无消息的助手会话
- **THEN** 空状态四卡标题 SHALL 分别为查文档/知识库、会议总结、相关聊天、需求梳理（或语义等价）
- **AND** MUST NOT 默认展示「策划需求」「研发实现」「测试验收」「制作推进」四张角色卡

#### Scenario: Workflow intake card prepares Daemon input

- **WHEN** 用户点击需求梳理（工作流）空状态入口
- **THEN** 系统 SHALL 发送引导整理飞书资料与结构化 intake 的提示
- **AND** 该场景 SHALL 关联需求技能并可指向默认 Daemon 工作流

### Requirement: Game role scenes remain routable without empty-state display

`game-design`、`game-dev`、`game-qa`、`game-production` 场景 MUST 继续参与关键词与 legacy 模式路由；它们 MAY 设置 `showInEmptyState: false` 以免出现在空状态。

#### Scenario: Legacy writing still maps to design

- **WHEN** industry/pack 解析到游戏能力包且 mode 为 writing
- **THEN** resolved scene 仍是 `game-design`

#### Scenario: Role scenes excluded from empty-state list

- **WHEN** UI 请求空状态场景列表
- **THEN** `game-design` / `game-dev` / `game-qa` / `game-production` MUST NOT 出现（若其 `showInEmptyState` 为 false）
- **AND** 连接向空状态场景 SHALL 出现
