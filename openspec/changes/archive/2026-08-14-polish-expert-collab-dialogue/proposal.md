## Why

本变更面向 **整个 KnowMe 专家 Agent 体系**（不只是某次协作对话房）：用户应能自主创建、编辑、调优多位专家，并让 Runtime 真正按专家配置运转。现状缺口包括——专家仍是单一 `systemPrompt` 换皮；缺 **Soul / SOP / AgenticType**；协作时未分层注入 KnowMe 默认结构与专家层；协作房侧栏能力只读、空态不像专家协作。需要把「可编辑的专家资产」与「可感知的专业 Runtime」一次对齐。

### 目标用户

- 自行搭建、编辑多位专家 Agent 的个人与团队用户
- 在工作台与不同专家协作、并期望行为随专家配置变化的知识工作者

### 商业化与体验价值

专家体系是 KnowMe 可沉淀、可复制的核心资产。Soul + SOP + AgenticType 让用户真正「拥有并编辑」专家；分层提示词与协作房可装配能力，把资产变成处处可用的专业工作伙伴。

## What Changes

### A. 协作对话房（既有缺口）

- 专家协作房右侧「连接器 / 技能 / 知识」可添加与管理（Session 级覆盖；不静默改精选包）。
- `expert-chat` 空态围绕当前专家（身份、专长、开工动作），MUST NOT 再用工作流「协作引导」模板。

### B. 提示词分层与初始化注入

- 梳理并固化 **KnowMe 对话结构默认提示词** 与 **专家 Agent 提示词** 的层级关系；初始化/每轮装配按层注入，专家层携带 Soul、SOP、属性、能力、提问与协作方式。
- 专家协作 Session 的 context assembly MUST 注入该专家快照中的高级专家块，而非仅一段扁平 `systemPrompt`。

### C. 专家编辑：Soul / SOP / AgenticType

- 创建与编辑专家时提供 **Soul**（特性化与风格）与 **SOP**（岗位职责与协作流程）分区输入。
- 提供 **AgenticType** 下拉，对齐 5 种模式：`reflection` / `tool_use` / `react` / `planning` / `multi_agent`。
- 界面按 AgenticType **联动**显示配置项与引导输入（如反射轮次、工具策略、规划产出、可委派角色等）。
- Agent Runtime 按 AgenticType 启用对应行为脚手架（自我审查、工具优先、ReAct 循环、先规划再执行、多智能体委派边界），使专家真正具备该模式能力。

## Capabilities

### New Capabilities

- `workbench-dialogue-chrome`: 专家协作房右侧能力装配与专家身份空态。
- `expert-agentic-profile`: 专家 Soul / SOP / AgenticType 模型、编辑器联动与 Runtime 模式脚手架。

### Modified Capabilities

- `expert-runtime`: EXPERT 包与 Session 快照纳入 Soul/SOP/AgenticType；Session 可覆盖技能/连接器绑定。
- `agent-context-assembly`: 固化 KnowMe 底座 ↔ Agentic 脚手架 ↔ Soul/SOP/专家属性 的注入顺序与优先级。
- `capability-hub`: 专家创建/编辑表单支持 Soul、SOP、AgenticType 及联动配置。
- `agent-chat-ux`: `expert-chat` 空态使用专家协作首屏。

## Impact

- Renderer：`workbench.js`、`workspace-agent.js`、`capability-hub.js`、相关 CSS
- Runtime：`expert-runtime.js`、`agent-context-assembly.js`、`capability-hub-service.js`、Session IPC
- 参考：`d:\downloads\5 种Agentic AI 设计模式.md`（Reflection / Tool use / ReAct / Planning / Multi-agent）
- 测试：装配分层单测、Hub 编辑契约、专家任务房静态契约

### 验收标准

- 与不同专家协作时，注入内容可区分（Soul/SOP/能力不同 → 首轮行为与口吻不同）。
- KnowMe 默认对话结构提示词与专家层关系在设计与实现上一致、可测。
- 新建/编辑专家可见 Soul、SOP、AgenticType；切换 Type 时表单联动变化。
- Runtime 对所选 AgenticType 有可观察行为差异（至少：规划型先出路线图；工具型强调用工具；反射型含自检步骤）。
- 协作房右侧连接器/技能/知识可管理；空态为专家协作首屏。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不在本 Story 重做整页 Capability Hub 信息架构。
- 不把 `multi_agent` 类型做成完整可视化多智能体编排器（Studio/货架已有工作流）；本 Story 只定义专家级委派策略与 Runtime 边界，完整图编排仍走工作流。
- 不自动安装未授权连接器或未安装技能。
- 不改 Daemon 管线调度协议本身。
- 不要求一次实现五套完全独立的执行引擎；以统一 Runtime + 模式脚手架/策略开关落地。
