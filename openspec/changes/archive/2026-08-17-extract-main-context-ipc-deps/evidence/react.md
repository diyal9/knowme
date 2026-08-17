# ReAct

- Reason：单例 `scope` 让 ipc-bind 绕过组合根；扁平袋无法按域导航。
- Act：`ctx` 由 index 创建；`createIpcDeps` 分组；抽出 icons / process-guards。
- Observe：结构测试与 lint 绿。
- Reflect：五模块内部仍写 `scope.xxx`（参数名）。下一波把 `register*Ipc` 改为吃分组对象，或让叶子 `createX` 返回方法而不是挂袋。
