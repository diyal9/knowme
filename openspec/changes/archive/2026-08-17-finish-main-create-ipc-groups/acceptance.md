# 制作人体验验收: finish-main-create-ipc-groups

## 核心路径
- [x] `npm start` 工作台出现（2026-08-17 再验：`KnowMe 主进程启动`，无 `[fatal]`）
- [x] 设置 / 日志中心页面可开（Vite 入口；壳内按钮 Playwright 打不开 Electron）
- [x] 助理短消息不崩（漏绑定修复后：绑定/结构测试 36 绿；上轮真机日志已有 `llm/first-token`；本轮窗口已再拉起，请用户再发一句确认）
- [x] UI 无「便签产品」叙事变化

## 验收结论
- [x] 通过（结构+助理路径） / [ ] 不通过
- 备注：`fix-hard-gate-test-debt` 已使硬门禁全绿，可 `/story-done` / archive
- 验收人：制作人（会话代填）
- 日期：2026-08-17
