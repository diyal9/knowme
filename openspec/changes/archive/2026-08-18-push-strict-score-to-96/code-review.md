# Code review — push-strict-score-to-96

结论：通过（评分证据 + 壳层收口，无新 IPC / 无新表面）。

- AppShell 不再内联 13 个 `lazySurface`；loader 集中在 `surface-registry`
- 测试仍走顶层 `await import`（`MODE === 'test'`），生产仍 `React.lazy`，避免把全部表面打进首包
- `lazySurface<P>` 入参 `unknown`、出参泛型；无 `ComponentType<any>`
- `RunSurfaceProps` 在注册表本地对齐 `{ taskRoom?: boolean }`（避免锁文件改 RunSurface）
- 性能 15 的证据是字节对照 + Virtuoso 契约，不是同机 FPS
- 体验 15 引用存量基线/React 截图 + `assistant.spec`；便签分屏等诚实缺口未假勾
- 未把 Playwright 塞进 `npm run check`
