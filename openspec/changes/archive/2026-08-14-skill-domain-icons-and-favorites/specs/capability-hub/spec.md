## ADDED Requirements

### Requirement: Domain-representative capability icons

技能与无头像的能力卡片 MUST 按工作域显示代表性图标，而非一律使用同一 sparkle/optimize 图标。至少 MUST 区分：写作、游戏、研发、办公；未知域 MUST 回退到该 kind 的默认图标。专家若已有预设头像 MUST 继续优先显示头像。

#### Scenario: Writing skill shows writing icon

- **WHEN** 用户在技能 Tab 查看主分类为「写作」的技能卡
- **THEN** 卡片图标为写作域代表图标（笔/文稿语义）
- **AND** 与「游戏」「研发」「办公」技能卡图标可区分

#### Scenario: Game skill shows game icon

- **WHEN** 用户查看主分类为「游戏」的技能卡
- **THEN** 卡片使用游戏域代表图标

### Requirement: Capability favorites with star and filter

能力 Hub MUST 允许用户收藏任意专家/技能/连接器条目。每张目录卡片 MUST 提供星标按钮；点击 MUST 切换收藏状态并持久化到本机用户数据。分类筛选 MUST 提供「收藏」chip；选中后 MUST 仅显示已收藏条目。

#### Scenario: Star toggles favorite without opening drawer

- **WHEN** 用户点击某能力卡片上的星标
- **THEN** 该条目收藏状态切换，星标视觉更新为空心/实心
- **AND** 不打开详情抽屉

#### Scenario: Favorites persist across relaunch

- **WHEN** 用户收藏某技能后退出并重新打开能力 Hub
- **THEN** 该技能仍显示为已收藏

#### Scenario: Favorites chip filters list

- **WHEN** 用户点击「收藏」分类 chip
- **THEN** 列表仅包含已收藏条目
- **AND** 「收藏」chip 呈选中态
