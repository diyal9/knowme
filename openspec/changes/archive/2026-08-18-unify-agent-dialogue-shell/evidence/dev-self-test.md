# 开发自测报告

- 日期：2026-08-16
- Change：unify-agent-dialogue-shell
- npm test: PASS
- npm run lint: PASS
- npm run typecheck:renderer: PASS
- npm run test:renderer: PASS
- 手动冒烟: 需 `npm start` 重启后：工作台任务对话发「你好」见时间线；停止键结束转圈；助理四模式回归一句
- 备注：主进程未改 IPC 形状；工作台发送路径已订 v2 流。热更不够看主进程时仍须重启。
