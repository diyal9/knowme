## ADDED Requirements

### Requirement: Enabled game capability pack supplies game scenes

当 `game-studio` 能力包已启用时，系统 MUST 从该能力包解析 `game-design`、`game-dev`、`game-qa` 与 `game-production` 场景、提示和默认工作流，而不是依赖核心代码中的行业专用分支。

#### Scenario: Explicit game scene is selected

- **WHEN** 用户显式选择已启用能力包中的游戏场景
- **THEN** 系统 SHALL 返回该能力包声明的场景、推荐技能和默认工作流

#### Scenario: Prompt matches a game scene

- **WHEN** 用户工作请求命中已启用能力包场景关键词
- **THEN** 系统 SHALL 使用该能力包场景生成工作伙伴上下文

### Requirement: Legacy game settings migrate idempotently

旧设置中的 `industry=game` 与 legacy agent mode MUST 可迁移到 `game-studio` 能力包，迁移 MUST 幂等且不改变已有 Session 标识。

#### Scenario: Existing game industry user starts upgraded app

- **WHEN** 旧用户设置为游戏行业且尚未启用 `game-studio`
- **THEN** 系统 SHALL 启用 bundled `game-studio` 能力包
- **AND** 重复启动 MUST NOT 创建重复 store 条目

#### Scenario: Legacy session is restored

- **WHEN** 旧 Session 使用 writing、coding、qa 或 planning mode
- **THEN** 系统 SHALL 通过能力包 legacy 映射解析对应游戏场景
- **AND** Session 原始标识 MUST 保持可恢复
