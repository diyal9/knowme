## 1. Step 1 — 布局与滚动

- [x] 1.1 调整 `workbench-layout.css`：过程日志容器 flex 铺满；运行日志 body 取消 240px 硬顶，PROGRESS 可保留上限
- [x] 1.2 `renderDaemonReviewBody(logs)`：贴底检测后再 `scrollTop`；内容签名未变则跳过整块重绘
- [x] 1.3 为贴底/签名辅助逻辑补单测或抽纯函数测试

## 2. Step 2 — SSE 与缓存

- [x] 2.1 新增可单测 SSE 行解析模块（`data:` 行 / `event: done` / ping）
- [x] 2.2 `workbench-daemon-client` 增加 `streamLogs`（Bearer + AbortSignal，无短超时打断）
- [x] 2.3 IPC：`logs-stream-start` / `logs-stream-stop` + `workbench-daemon-log-event`；preload 暴露 API
- [x] 2.4 `workbench.js`：按 slug 缓存；首屏 `/logs`；运行中启 SSE 并 skip 回放行；轮询跳过全文 logs；离任务 stop
- [x] 2.5 SSE 失败降级：偶发 `/logs` 尾部对齐 + 贴底规则仍生效
- [x] 2.6 更新 `docs/daemon/README.md` 已用 API 清单含 `logs/stream`

## 3. 验证

- [x] 3.1 单测覆盖 SSE 解析与 review 投影/缓存辅助
- [x] 3.2 `npm test` 与 `npm run lint` 通过；写 `evidence/dev-self-test.md`
