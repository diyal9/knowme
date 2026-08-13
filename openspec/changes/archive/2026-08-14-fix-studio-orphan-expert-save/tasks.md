## 1. Error + Studio UI

- [x] 1.1 保存 / plan 失败：翻译 `unresolved_member` / `unresolved_node_agent` 为可读中文
- [x] 1.2 `studioExpertOptionsHtml`：候选外 selectedId 显示「已失效」
- [x] 1.3 画布专家节点对失效 id 使用 warn 摘要（可选但建议）

## 2. Workflow store + delete hook

- [x] 2.1 `workflow-package-store.clearExpertRefs(expertId)`
- [x] 2.2 `onExpertUninstalled` 调用 mode unbind + clearExpertRefs

## 3. Verification

- [x] 3.1 单测：友好错误文案辅助函数 / clearExpertRefs
- [x] 3.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md`
