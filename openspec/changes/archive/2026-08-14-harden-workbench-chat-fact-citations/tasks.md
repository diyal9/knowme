## 1. 事实门禁与 citation 纯函数

- [x] 1.1 扩展 `workbenchGroundingRules`：第一性原则 + 强制引用来源 + 禁止幻觉
- [x] 1.2 新增 `buildWorkbenchCitations(context)` / `formatWorkbenchCitationsForPrompt`
- [x] 1.3 单测覆盖规则关键词与 citation 构建

## 2. 工作台对话注入与 UI

- [x] 2.1 `workbenchContextText` 注入本轮可用来源清单与引用格式要求
- [x] 2.2 发送时把 citations 快照到本轮 assistant 消息
- [x] 2.3 气泡渲染「引用来源」；样式；与 grounding meta 并存
- [x] 2.4 `qa-plan.md` + `evidence/dev-self-test.md`；`npm test` / `npm run lint`
