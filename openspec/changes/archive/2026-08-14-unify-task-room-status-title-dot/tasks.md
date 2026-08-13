## 1. Projection

- [x] 1.1 在 `dialogueStatusProjection`（或统一出口）对协作/工作流：有独立副身份时拼成 `{title} · {meta}` 并清空 meta
- [x] 1.2 管线服务路径不回归双段 meta；无副身份时不产出孤立 `·`

## 2. Chrome / CSS

- [x] 2.1 确认 `#agentDialogueStatusMeta` 在上述场景隐藏；必要时微调 `.agent-dialogue-status-title` 最大宽度

## 3. Verification

- [x] 3.1 `npm test` 与 `npm run lint` 通过
- [x] 3.2 写入 `evidence/dev-self-test.md`；手动对照协作 / 工作流 / 管线三顶栏
