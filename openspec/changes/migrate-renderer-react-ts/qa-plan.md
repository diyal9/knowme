# QA Plan — migrate-renderer-react-ts

## Smoke Scope

1. `KNOWME_RENDERER=legacy`：启动 → 工作台 → shelf → 打开一工作流入口 → 返回（与基线一致）。
2. `KNOWME_RENDERER=vite`：同上路径；rail 助理/工作台切换。
3. vite：task-room / Daemon 审阅若可达，确认 HITL 与返回不丢。
4. `npm test`、`npm run lint`、`npm run typecheck`。
5. 打包路径：`npm run renderer:build` 后无开关时仍 legacy；`vite` + dist 可加载。

## Anti-patterns

- vite 入口出现新文案/新导航项（产品变更）→ fail。
- 渲染进程直接使用 ipc → fail。
- 默认入口变为 vite 且无法回滚 → fail。

## Evidence

- `evidence/dev-self-test.md`
- `parity-matrix.md` 勾选
- 可选截图：`evidence/screenshots/`
