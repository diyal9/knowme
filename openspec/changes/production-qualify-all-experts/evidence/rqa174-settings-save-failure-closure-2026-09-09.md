# RQA174 — 设置保存失败闭环

## 问题

`save-settings` 返回 `{ ok: false, warning }` 时，设置页原先仍会清除 dirty 状态并提示“设置已保存”。这会让用户误以为 API Key 已经可用，下一次专家执行才暴露安全存储问题。

## 修正

`useSettingsForm.save` 现在：

- 将 IPC 返回的 `warning/error` 展示在设置页；
- 保存失败时保留未保存状态，允许用户修正后再次保存；
- IPC 未返回结果时也按失败处理；
- 只有明确 `{ ok: true }` 才清除 dirty 状态并提示成功。

## 验证

- 设置页 Renderer 定向测试：`10/10` 通过。
- `npm run check:quick`：lint 通过，Renderer 测试通过；新增设置失败回归已纳入全量 Renderer。
- 后端安全存储与 Provider 定向测试：`13/13` 通过。

该项修复的是凭据恢复的用户交互闭环，不代表当前沙箱已经具备可用的真实 DPAPI、Provider 或外部连接器，因此不提升专家生产资格。
