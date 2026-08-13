## Decision

1. 组件栏只保留「组件」标题与调色板；去掉 `#wbStudioAddAgent`。
2. 专家选择弹窗标题栏常驻「专家库」按钮（`capabilityStack` 图标 + 文案）。
3. 点击后隐藏弹窗并设 `resumeStudioExpertPickerAfterHub`；`closeDrawer` 在关闭 `capability-hub` 时派发 `knowme-drawer-closed`；工作台监听后 `refreshModes` 并重新 `openStudioExpertPicker`。

## Non-goals

- 不改专家库内部「添加到工作台」逻辑（已有 bind + refreshModes）
- 不恢复侧栏内嵌专家列表
