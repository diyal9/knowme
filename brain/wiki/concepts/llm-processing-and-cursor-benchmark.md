# KnowMe 的 LLM 处理链路与 Cursor 对标

本页用于解释 KnowMe 当前的 LLM 运行时能力、上下文编排方式、工具执行闭环，以及与 Cursor 参考能力的对齐状态。

## 一句话结论

KnowMe 已具备与 Cursor L3 参考实现同构的核心闭环：**多会话上下文编排 + 按预算压缩 + 工具循环执行 + 记忆注入门控 + 可观测性输出**。当前差距主要在跨设备云端状态与平台级生态能力，不在本地核心链路。

## LLM 处理主链路

1. 请求进入主流程，按会话、角色、任务层级（chat/assist/retrieval）路由模型与策略。
2. 运行时计算请求策略（上下文窗口、输入预算、输出预算、温度约束）。
3. 上下文编排器构建动态上下文分段：角色方式、时间锚点、本轮理解、Session 摘要、检索结果、记忆片段。
4. 分段上下文按优先级和 token 预算裁剪，再与系统提示词和历史消息合成 API 消息。
5. 对完整对话做轮次级压缩，保证工具调用与结果不被拆散。
6. 进入工具循环：模型可选择调用工具；系统执行并回填结果；直到达到收敛条件后生成最终答复。
7. 记录上下文与执行观测信息（如 sectionUsage、sectionOmitted、memoryPolicy、omittedTurns）。

## 当前实现的关键能力

- 上下文编排器已模块化，支持统一入口与可测试策略。
- 记忆注入采用策略门控：可禁用、可按 tier 限制、空记忆自动跳过。
- 分段裁剪与对话裁剪并存：前者保障内容优先级，后者保障轮次完整性。
- 工具循环有预算上限（轮次/调用数）与重复调用检测，避免无穷循环。
- 失败降级与最终答复收敛机制可在预算耗尽或重复调用时触发。
- UI/日志可见关键执行轨迹，便于排障和回归。

## Cursor 对标结果（必做能力清单）

- 已覆盖：多 Session 独立历史与上下文拼装。
- 已覆盖：动态上下文分层（角色、时间、任务理解、检索、记忆）。
- 已覆盖：按预算上下文压缩与对话轮次压缩。
- 已覆盖：工具调用执行闭环（调用、结果注入、继续推理、最终收敛）。
- 已覆盖：记忆注入策略可控（启用/禁用/原因）。
- 已覆盖：执行可观测信息输出（含上下文分配与省略信息）。
- 部分覆盖：更大范围的跨工作区/跨设备云端记忆与统一账号态（非本次本地实现目标）。

## 代码锚点（便于追踪）

- 上下文编排：`src/lib/agent-context-orchestrator.js`
- 预算与压缩：`src/lib/llm-runtime.js`
- 工具循环状态：`src/lib/agent-loop.js`
- 主流程接入：`src/main.js`
- 单测：`tests/agent-context-orchestrator.test.js`

## 相关知识

- OKF 长期规范页：`brain/knowledge/concepts/llm-processing-and-cursor-benchmark.md`
- 多 Agent Runtime：`brain/wiki/concepts/production-agent-team-runtime.md`
- 产品概览：`brain/wiki/concepts/knowme-overview.md`
- Electron 架构：`brain/wiki/concepts/electron-architecture.md`
