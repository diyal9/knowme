# ReAct

- Reason：编号切片无法导航；1200/2000 预算允许按域合并。
- Act：五模块 `attach(scope)` + 删 part-*；测试改读 module-list.json。
- Observe：结构测试与 lint/typecheck 绿；全量 test 仍有执行器既有红。
- Reflect：本波未拆 `scope` 袋。下一 change 按 IPC 域收 deps，而不是再切文件。
