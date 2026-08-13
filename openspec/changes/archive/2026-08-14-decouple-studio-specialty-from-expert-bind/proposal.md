## Why

编排画布上「大模型 / 工具 / 知识库」被强制绑定「执行专家」，与用户心智不符：大模型应直接选 LLM Hub 模型，工具与知识库应是确定性能力节点，只有「专家」才需要 Agent Package。当前实现把 specialty 全部 `COMPILE_AS_AGENT`，导致产品语义扁平化，也无法对齐 Daemon 多 runner（agent / script / 等）的执行模型。

## What Changes

- **大模型节点**：移除「执行专家」必填；模型改为从 LLM Hub / 模型目录选择（非手填裸字符串）；属性保留 Prompt、温度、输入输出说明。
- **工具 / 知识库节点**：移除「执行专家」必填；分别必填 Skill / 知识库；按直连执行语义校验与编译。
- **专家节点**：仍为唯一必须绑定本地 Agent Package 的能力节点。
- **编译与 Runtime**：**BREAKING（草稿语义）** — `llm|tool|knowledge` 不再编译为伪装 `type: agent`；改为一等 runtime 节点类型，由 Team Workflow Runner 分派执行（对齐 Daemon「节点族 → runner」思路）。
- **校验**：`validateDraft` 不再对 specialty 报 `missing_agent`；改为类型专属必填（模型 / skill / knowledgeId）。
- **UI**：卡片内联与右侧 Inspector 同步去掉 specialty 的专家选择；调色板 hint 文案更新。
- 历史草稿若 specialty 上残留 `agentPackageId`：保存时忽略该字段，不强制用户重绑专家。

## 目标用户

- 在工作台编排「专家协作 / 自动化流程」的产品用户与制作人
- 需要组合「一次 LLM 调用 + 工具 + 检索 + Agent」而非「每步都塞一个专家」的编排者

## 验收标准

1. 拖入大模型节点 → 仅选 Hub 模型 + Prompt，可不选专家即可保存并通过校验。
2. 拖入工具 / 知识库 → 分别只配 Skill / 知识库即可保存；不出现「需要绑定本地专家」。
3. 专家节点仍必须选 Package；缺绑则拦截。
4. 含 `llm → tool`（无专家）的草稿可测试运行至完成或给出可理解失败（非 missing_agent）。
5. 条件 / 汇合 / 人工确认 / 开始 / 结束行为不变。

## 非目标（Non-goals）

- 不接入 AutoGen / Magentic-One 式多 Agent 对话编排
- 本 Story 不实现完整 Daemon `script` 节点 parity（可列为后续）
- 不重写 `AgentRunExecutor` 工具循环内核
- 不改变 Daemon HTTP 协议与远程管线语义
- 不删除「专家」节点或轻量模式串行步骤

## Capabilities

### New Capabilities

- `studio-specialty-runtime`：专业画布 specialty（llm / tool / knowledge）作为一等 runtime 节点的编译、校验与执行契约

### Modified Capabilities

- `agent-composition-studio`：specialty 不再强制绑定专家；大模型模型选择来自 LLM Hub；Inspector / 卡片字段与校验规则更新（废止「必须绑 Package」的 specialty 要求）

## Impact

- UI：`src/workbench.js` Inspector / 调色板；`src/lib/workbench-studio-canvas.js` 卡片字段
- 模型：`src/lib/workbench-studio-model.js`（`COMPILE_AS_AGENT`、`validateDraft`、`compileFree`、`buildProfileForKind`）
- Runtime：`src/lib/agent-team-workflow-runner.js`、`src/lib/workbench-agent-graph.js`（识别非 agent 可执行节点）
- LLM：复用 `llm-model-catalog` / `llm-runtime` / 现有 `llmModels` IPC
- Skill / Knowledge：复用既有 skill 执行与知识检索入口（fail-closed）
- 测试：`tests/workbench-studio-*.test.js`、Team runner 相关单测
- 关联变更：`surface-specialty-node-expert-bind` 的「卡片暴露执行专家」对 specialty 的强制要求由本变更废止/ supersede

## 商业化与体验价值

降低编排门槛：用户能像 Daemon/主流 workflow 一样「拼原子能力」，而不是「每个方块都先挑一个专家」。专家保留为高价值完整 Agent，大模型/工具成为轻量积木，利于留存与专业管线自建转化。
