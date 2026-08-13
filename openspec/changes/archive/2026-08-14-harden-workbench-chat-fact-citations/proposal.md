## Why

工作台管线对话会解释任务状态、澄清问题与产物；当前虽注入「任务事实」，但模型仍可能编造流程角色或省略引用来源，用户无法核验依据，信任与交付质量受损。

目标用户：在 KnowMe 工作台运行 Daemon/工作流、依赖对话指挥与排障的知识工作者与开发者。

商业化与体验价值：工作管线对话成为「可审计工作伙伴」——事实作答 + 来源可见，是付费专业工作台与通用助手的关键差异。

## What Changes

- 工作台对话 MUST 仅基于任务事实、本轮工具结果、用户明确提供材料作答；引入第一性原则拆解：先界定已知事实 → 缺口 → 可验证下一步。
- 涉及工作材料（产物、日志、澄清、知识/工具命中）时，回答 MUST 标明引用来源；气泡下方展示「引用来源」列表。
- 强化 `workbenchGroundingRules` 与上下文注入：本轮可用来源清单写入提示词；禁止幻觉补全。
- 非工作台助手模式行为不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：工作台协作对话的事实门禁与引用来源展示要求。
- `agent-chat-ux`：工作台 surface 助手气泡的引用来源 UI。

## 目标用户

- 在工作台跑管线、用左栏对话指挥任务、排查 need_input / Gate / 产物问题的用户。

## 验收标准

- 工作台任务对话中，解释状态或引用材料时，气泡可见「引用来源」（至少含任务事实/产物路径/工具来源之一，有则展示）。
- 提示词含第一性原则与禁止幻觉门禁；单测覆盖规则文案与 citation 列表构建。
- 助手模式（非 workbench surface）无强制工作台 citation 条回归。

## 非目标（Non-goals）

- 不重做 grounding runtime / OutputGate 内核。
- 不强制外链网页检索；仅要求「已有证据」可追溯。
- 不改变 Daemon API 或 HITL 提交流程。

## Impact

- `src/lib/workbench-task-brief.js`：规则与 citation 纯函数
- `src/workspace-agent.js` / `workspace.html`：注入与 UI
- `tests/workbench-task-brief.test.js`
- OpenSpec：`pipeline-run-review-surface`、`agent-chat-ux` delta
