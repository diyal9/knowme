# Code review: extract-main-context-ipc-deps

结论：**通过（结构）**。无 `scope.ts` / `ipc-bind.ts`；`index` 创建 ctx 后 `create` + `bindCoreIpc`。
