## Smoke Scope

- 应用启动，工作台窗口打开
- 设置 / 记忆 / 日志窗可从 IPC 或菜单打开
- 托盘显示/隐藏
- `npm test`、`npm run test:renderer`、`npm run typecheck:renderer`、`npm run lint` 全绿

## 回归

- workspace-init 仍返回 notes 列表（兼容读 `%APPDATA%/KnowMe/notes`）
- preload `window.api` 方法名未变
