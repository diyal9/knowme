## 1. Model

- [x] 1.1 `ensureFreeGraph` 增加 `markDirty` 选项；渲染归一化可保留原 dirty
- [x] 1.2 单测：linear→free 且 `markDirty:false` 时 dirty 仍为 false

## 2. Workbench

- [x] 2.1 `renderStudioBoardGraph` 调用 `ensureFreeGraph(..., { markDirty: false })`
- [x] 2.2 `confirmLeaveStudio` 忽略仅含 start/end 的草稿
- [x] 2.3 `saveStudioWorkflow` 成功后、切货架前清除 dirty
- [x] 2.4 内联失焦 / 检查器同步在内容未变时不标 dirty；无流程字段时不同步空 IO
- [x] 2.5 成功离开编排回货架时清空内存草稿（`leaveStudioToShelf`）

## 3. Verification

- [x] 3.1 补充/更新静态或模型单测
- [x] 3.2 `npm test` 与 `npm run lint`；写 `evidence/dev-self-test.md`
