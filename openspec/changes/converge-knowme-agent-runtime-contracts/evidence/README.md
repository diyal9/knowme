# Evidence

本目录在实现阶段保存可复核证据，不预先填写通过结果。

预期文件：

- `baseline.md`：原问题 fixture、失败断言和隔离数据说明。
- `impact-report.md`：修改符号的 GitNexus impact 与直接调用方。
- `focused-tests.md`：定向测试命令、结果和失败修复记录。
- `test-report.md`：最终全量检查、限制和未执行项。
- `desktop-acceptance.md`：Electron 执行前/执行中/刷新/重启验收步骤与截图索引。
- `change-scope.md`：GitNexus detect_changes、实际文件范围和既有脏工作区边界。

不得复制其他 change 的历史绿灯作为本变更证据，不得把模拟外部写入描述为真实供应商验证。
