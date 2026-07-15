# QA Plan: knowledge-settings-refactor

## Smoke Scope（必填）

- [x] 知识库页文案更短，无大块路径首屏
- [x] 点击概念可查看正文
- [x] 预览可「实例化为卡片」
- [x] 仅勾选一主题导出成功
- [x] 全选导出概念数=整库

## Regression Scope

- [x] 导入 OKF 仍可用（IPC / 按钮保留）
- [x] 记忆面板入口仍可用（摘要旁「记忆」）

## Anti-pattern Checks

- [x] 未勾选主题时导出有明确提示（不全量静默）
- [x] 预览不误触实例化（须明确按钮）
