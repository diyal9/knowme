## 1. Projection

- [x] 1.1 在 `workbench-daemon-surface.js` 新增 `compactDaemonCardTitle`，并让 `daemonTaskCardView` 的 `cardTitle` 使用它
- [x] 1.2 保持 `title` / `intentTitle` 为完整 intent，供 tooltip 与搜索

## 2. UI polish

- [x] 2.1 将 `.wb-daemon-task-copy strong` 改为单行省略（line-clamp: 1）

## 3. Tests & gate

- [x] 3.1 扩展 `tests/workbench-daemon-surface.test.js`：标签+URL → 紧凑标题；短 intent 不变
- [x] 3.2 `npm test` + `npm run lint`；写 `evidence/dev-self-test.md`
