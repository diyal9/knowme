## 1. Style & markup

- [x] 1.1 调整 `.wb-workflow-manage-flow-step`：去掉 `9.5em` 固定裁切，改为卡片内完整可读（`max-width:100%`）
- [x] 1.2 `workflowBriefFlowHtml` 为步骤标签写入完整 `title`

## 2. Tests & evidence

- [x] 2.1 测试断言不再依赖 `max-width:9.5em`，并覆盖 title / 完整展示约定
- [x] 2.2 `npm test` + `npm run lint`；写 `evidence/dev-self-test.md` 与 `qa-plan.md`
