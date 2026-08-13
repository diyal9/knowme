# Proposal: quality-pass-abcde-harden

## Why

用户确认品质向上五项（A–E）均可推进。在「不改坏、不大动交互」约束下，本 change 落地安全硬项与体验闭环小切片，避免上帝文件大拆引发回归。

## What Changes

### D 安全
- `file:` 外链改走 `shell.openPath`，禁止 webview 嵌 file
- `will-attach-webview` 收紧 guest 权限与协议
- `publicSettings` 默认 redact apiKey/gitlabToken；仅设置窗含明文
- `readFileUnder` 增加体积上限

### B 不闭环
- 知识库选择在 API 缺失时只展示说明、不可点
- 产物审阅无 workSurface 时降级打开文本/链接而非死 toast
- 文件选择器按钮在 API 缺失时禁用

### C 演示残留
- 货架徽章「团队」→「官方/共享」语义；空态文案去「团队演示」感
- 种子常量标注 legacy 兼容，不进货架

### A Token
- Hub `--hub-accent` 对齐工作台绿
- layout 高频 primary/绿硬编码接 `--wb-accent`

### E 结构/性能（低风险）
- workbench `esc` 优先委托 `UIKit.escapeHtml`
- 不在本 change 拆分万行上帝文件 / 聊天虚拟列表（单列 follow-up）

## Out of Scope
- workbench.js / main.js 大规模拆分
- 聊天增量渲染重构
- 实现完整「产物审阅」新产品能力（仅修降级路径）
