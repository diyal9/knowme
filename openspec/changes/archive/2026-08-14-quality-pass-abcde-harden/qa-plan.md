# QA Plan: quality-pass-abcde-harden

## Smoke Scope
- [ ] 工作台主按钮 / 弹窗 primary 为绿 accent
- [ ] 货架徽章：官方 / 我的 / 共享（不再一律「团队」）
- [ ] 设置页 API Key 仍可显示与保存
- [ ] 工作台打开本地 file 链接：系统默认应用打开，不内嵌 webview
- [ ] 管线服务选材料：选择器可用（有 API）

## Regression
- [ ] 助手对话 / 工作流启动 / Daemon 审阅
- [ ] Hub 专家库主色偏绿，可接受

## Anti-pattern
- [ ] 非设置窗不应能从 getSettings 读到明文 Key（需开发验证 / 日志）
