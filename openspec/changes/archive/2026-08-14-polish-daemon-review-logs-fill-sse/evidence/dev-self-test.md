# Dev self-test: polish-daemon-review-logs-fill-sse

Date: 2026-08-13

## Automated

- [x] `npm test` — **1759/1759** pass
- [x] `npm run lint` — ok (`lint` + `script-scope`)

## Unit coverage

- [x] `tests/workbench-daemon-log-sse.test.js` — SSE 分块解析、`event: done`、贴底判定、merge/append、签名稳定

## Implementation checklist

### Step 1

- [x] CSS：过程日志 flex 铺满；去掉运行日志 `max-height: 240px`
- [x] 贴底跟随 / 上滚锁定；内容签名未变跳过整块重绘

### Step 2

- [x] `workbench-daemon-log-sse.js` 纯模块
- [x] client `streamLogs` + IPC start/stop + preload 事件
- [x] `workbench.js` slug 缓存、首屏 `/logs`、SSE skip 回放、轮询跳过全文、离任务 stop
- [x] SSE 失败降级定时拉 `/logs`
- [x] `docs/daemon/README.md` 已用 API 含 `logs/stream`

## Manual smoke (建议制作人验收时点)

1. 打开运行中/失败任务 →「过程日志」→ 运行日志区应铺到底
2. 上滚后等待增量 → 不被拽回底部；贴底时跟随
3. 离开任务再进 → 无残留刷屏；终态可见历史
