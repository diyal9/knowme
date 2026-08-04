# Proposal: game-studio-work-partner-daemon

## Why

KnowMe 已具备工作台 Daemon、飞书连接器与 Skill/Expert 运行时，但仍以通用办公四模式（general/steward/writing/coding）呈现，无法在手机游戏研发公司形成「策划需求案 → 研发交付 → 测试验收 → 制作推进」的可验证闭环。对标 WorkBuddy 的接续工作与任务编排原则，需要将产品垂直化为游戏工作室工作伙伴，且 Daemon 状态必须诚实、可恢复，不得伪造已连接。

## 目标用户

- 手机游戏公司策划：撰写结构化需求案、引用飞书资料、审批后写入草稿
- 客户端/服务端开发：从需求案交接至 Workbench，经真实 Daemon 工作流启动开发并审阅产物
- QA 与制作人：验收标准对齐、反模式审查、版本风险推进

## What Changes

- 新增 **游戏工作室场景 Skill 层**：策划需求、研发实现、测试验收、制作推进四类场景，legacy agentId 仅作兼容映射
- 新增 **结构化游戏需求案** 模型与飞书 grounded 审批路径（认证不可用时契约/fixture 验证）
- 新增 **需求 → Workbench Daemon handoff**：真实健康检查、workflow 列表、启动、状态、失败与恢复
- 统一 Workbench 任务追溯：场景 Skill、Connector、知识来源与 Session/Run 关联
- 保留左 Rail 与现有视觉语言；主内容区展示任务场景而非技术名词堆叠
- 补足单元/集成测试与自动化 UAT 证据（截图 + Word 报告）

## Capabilities

### New Capabilities

- `game-studio-scenes`: Skill 驱动的游戏工作室四类场景选择与 legacy 兼容
- `game-requirement-doc`: 结构化游戏需求案（背景、目标、玩法、规则、数值/资源、埋点、验收、风险）
- `game-workbench-handoff`: 需求案到 Daemon workflow 的诚实交接与运行态渲染

### Modified Capabilities

- `workspace`: 游戏行业下任务场景 UI、Workbench 任务追溯与 Daemon 诚实状态
- `agent-context-assembly`: 动态选择场景 Skill、Connector 与上下文 tier
- `office-assistant`: 游戏策划需求案飞书读取/引用与写操作审批语义
- `agent-skills-runtime`: 新增游戏工作室 bundled skills 与 game-studio-partner expert

## Impact

- `src/lib/game-studio-scenes.js`, `game-requirement.js`, `game-workbench-handoff.js`
- `src/catalog/skills/*`, `src/catalog/experts/game-studio-partner/`
- `src/main.js`, `src/preload.js`, `src/workspace-agent.js`, `src/workbench.js`
- `tests/game-*.test.js`, OpenSpec evidence 与 UAT Word 报告

## 验收标准

- 游戏行业用户面对任务场景（非 Agent/Skill 技术堆叠），KnowMe 单一第一人称身份不变
- 策划可创建结构化需求案；飞书 grounded 与审批路径可验证（或 fixture 标明限制）
- 需求案可交接 Workbench；Daemon 健康检查、workflow、启动、状态、失败恢复均为真实契约
- legacy general/steward/writing/coding Session 兼容；左 Rail 保留
- `npm test` / `npm run lint` / harness gate 全绿；核心 UAT 截图与 Word 报告齐备

## Non-goals

- 不复制 WorkBuddy 品牌或 UI
- 不引入过重新依赖；不绕过飞书/MCP 写操作审批
- 不在 Daemon 不可用时伪造 ready 或静态假数据冒充运行
- 不删除左 Rail 按钮
