# Code review: finish-main-create-ipc-groups

## 范围
`src/main/*.ts` 组合根 `create(ctx)` + `createIpcGroups` / `pick`；IPC 通道按域注入。

## 结论
**通过（结构）**。组合根清晰；`ai-generate` 等交叉通道 pick 全域，避免漏 deps。`ctx` 仍是运行时袋（Hub ↔ mode store），属对象图而非未完成切片。

## 备注
- 测试里 `scope.` 字面量未随重构改干净，已补 `ctx.`。
- 不建议再拆 `ctx` 字段，除非有独立 OpenSpec。
