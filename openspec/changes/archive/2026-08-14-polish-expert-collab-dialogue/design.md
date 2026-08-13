## Context

See proposal.md — Why。

参考：[5 种 Agentic AI 设计模式](file:///d:/downloads/5%20种Agentic%20AI%20设计模式.md)（Reflection / Tool use / ReAct / Planning / Multi-agent）。

现状：

- 专家仅 `systemPrompt` 扁平注入（`buildExpertPersonaBlock`）。
- Hub 编辑器单框「系统提示词」，无 Soul / SOP / AgenticType。
- 协作房侧栏只读；`expert-chat` 空态误用工作流引导。
- KnowMe 底座提示词（输出协议、伙伴协作、安全/引用等）与专家层关系未文档化、未结构化组装。

## Goals / Non-Goals

**Goals**

- 定义并实现提示词分层栈；专家协作按专家配置注入。
- EXPERT 包与编辑器支持 Soul、SOP、`agenticType` + 联动配置；Runtime 按类型启用脚手架。
- 协作房侧栏可操作 + 专家空态。

**Non-Goals**

- 不为五种类型各写一套独立 Agent 框架。
- `multi_agent` 不替代 Workflow Studio 图编排。

## Decisions

### 1. 提示词分层栈（装配顺序，底层先、上层专精）

| 层 | 来源 | 作用 |
|----|------|------|
| L0 KnowMe 对话结构 | 产品默认（输出协议、伙伴语气边界、引用/诚实、工具结果使用规范） | 所有 Session 共用，专家不可关闭关键安全/协议约束 |
| L1 Agentic 脚手架 | 由 `agenticType` 生成的模式指令 | 反射轮次、工具优先、ReAct、先规划、委派边界 |
| L2 Soul | 专家 Soul | 性格、风格、价值观、提问口吻 |
| L3 SOP | 专家 SOP | 岗位职责、步骤、交付物、协作方式（何时问用户/何时自决） |
| L4 专家元数据 | 属性、能力标签、绑定技能/连接器摘要 | 能力边界声明 |
| L5 Session | 任务目标、knowledgeRefs、用户本轮材料 | 本次协作上下文 |
| L6 技能正文 | 自动匹配 L0 / 显式 `/slash` L1 | 用户显式技能可覆盖方法细节，但不得削弱 L0 安全/协议 |

**优先级冲突**：L0 协议与安全 ALWAYS 胜；用户显式 `/slash` 胜 L3 方法细节；Soul/SOP 胜通用底座闲聊风格。

兼容：旧专家仅有 `systemPrompt` 时，映射为 `SOP = systemPrompt`，Soul 可空，`agenticType` 默认 `react`。

### 2. Soul vs SOP vs 旧 systemPrompt

- **Soul**：短文，偏「你是谁、怎么说话、审美与禁忌」。
- **SOP**：结构化职责与流程（可 Markdown 列表）。
- 持久化：EXPERT.md frontmatter / 正文分区；运行时组装为专家块，不再要求用户维护单一巨型 systemPrompt。导出时 MAY 生成合成 `systemPrompt` 供旧读取路径兼容。

### 3. AgenticType → Runtime 行为

| Type | UI 联动配置（示例） | Runtime 脚手架 |
|------|---------------------|----------------|
| `reflection` | 最大自检轮次、验收清单提示 | 产出前强制自检步骤；可要求修订稿 |
| `tool_use` | 默认工具策略、必选连接器提示 | 优先工具/检索，禁止空转空想（在检索意图下） |
| `react` | （默认）工具+反思开关 | Thought→Act→Observe 循环提示；默认推荐类型 |
| `planning` | 是否先输出计划、计划确认门闩 | 先路线图再执行；可与 HITL/澄清对齐 |
| `multi_agent` | 可委派角色/专家 ref、委派条件 | 声明何时委派；本 Story 不跑完整多 Agent 图，可提示用户转工作流或调用已绑定协作出口 |

### 4. 编辑器联动

- 下拉 `AgenticType` 切换后：显示对应配置字段，隐藏无关项；切换不丢已填 Soul/SOP。
- 占位文案随 Type 变化（如 Planning：「先列出阶段与依赖…」）。

### 5. 协作房侧栏（沿用前一版决策）

- 知识 / 技能 / 连接器 Session 覆盖；精选包不静默改写；「我的专家」可深链调优。

### 6. 空态

- `expert-chat` → `renderExpertCollabEmptyState`；展示 Soul/SOP 摘要或能力标签，强化专业感。

### 7. 进程边界

- 解析与校验在主进程（`expert-runtime` / hub-service）。
- 装配纯函数在 `agent-context-assembly`（可单测）。
- Renderer 只提交结构化字段，不拼最终系统提示词。

## Risks / Trade-offs

- [提示词过长超预算] → 分层截断：优先保 L0 + L2/L3 摘要 + L5；技能 L1 仍有既有 budget。
- [五种模式行为差异不够明显] → 验收用固定专家夹具对比首轮结构（计划块 / 自检块 / 工具调用意图）。
- [multi_agent 用户期望完整团队] → UI 文案说明「委派策略；完整编排请用工作流」。
- [旧专家迁移] → 默认 `react` + SOP←systemPrompt，无破坏性。

## Migration Plan

1. 读盘：无 Soul/SOP/Type → 兼容映射。
2. 保存：写新字段；保留合成 `systemPrompt` 只读兼容字段（可选）。
3. 回滚：装配回退到单块 systemPrompt。

## Open Questions

- 无阻塞项。`multi_agent` 与 Studio 的深度打通列为后续 Story。
