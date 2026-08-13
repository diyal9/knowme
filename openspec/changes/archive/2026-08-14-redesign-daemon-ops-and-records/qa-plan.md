# QA Plan — redesign-daemon-ops-and-records

## Smoke Scope

- [ ] Daemon Tab：在线时首屏 ≤4 条常用路径；可展开更多
- [ ] 选中路径：材料体检可见；阵容默认折叠，可展开
- [ ] 离线：开工禁用；材料缺失：警告但仍可点开工（在线时）
- [ ] 管线记录：intent 标题；「需要你」筛选可用
- [ ] 打开记录：状态/下一步/产物可见；日志默认折叠
- [ ] 「任务」Tab 不受影响；文案不把 Daemon 记录叫成任务首页任务

## Anti-patterns

- 不应默认展示整屏专家阵容墙
- 不应把 slug 当作唯一标题
- 不应与「任务」Tab 语义混淆
