# QA Plan: refine-fab-as-notification-anchor

## Smoke Scope（必填）

- [ ] 首次进入工作台：铃铛贴在右下角（边距 ≤8px）
- [ ] 打开面板：无「继续工作」Session 卡；无「恢复这个 Session」
- [ ] 存在可恢复 Session 时：铃铛无红点（本迭代无其它通知源）
- [ ] 日志中心 / 日志目录图标仍可打开对应能力
- [ ] 纵向拖动铃铛后位置可持久化；刷新后仍靠右

## Regression Scope

- [ ] 浅色 / 深色主题铃铛可辨
- [ ] Escape / 点外部关闭面板
- [ ] Agent 处理中光环仍可用（若生成中）

## Anti-pattern Checks（交给测试）

- [ ] 面板是否仍像「工作恢复」而非通知入口
- [ ] 贴角后红点是否被窗口边缘裁切
- [ ] 是否误删工作台其它 Session 恢复能力
