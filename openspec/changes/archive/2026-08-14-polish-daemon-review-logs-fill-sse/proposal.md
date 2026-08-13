## Why

「过程日志」Tab 被 `max-height: 240px` 裁切，下方大片空白；任务运行中每 2 秒全文重拉 `/logs` 并强制贴底，用户无法上滚阅读。管线服务已提供 `GET /api/tasks/{slug}/logs/stream`（SSE），KnowMe 尚未接入，造成卡顿与刷屏感。

## What Changes

- **Step 1（体验）**：过程日志区纵向铺满审阅面底部；仅在用户已贴底时自动滚到底；日志/progress 文本未变则跳过整块重绘。
- **Step 2（增量）**：首屏一次性拉取 `/logs` 写入按 slug 的内存缓存；运行中改由主进程订阅 SSE 追加行；状态轮询不再反复拉全文日志；SSE 失败时降级为偶发全文拉取。
- 更新 Daemon 客户端 / IPC / preload；补充单测与 qa-plan。

## 目标用户

在工作台查看管线任务执行日志的开发者 / 制作人 / QA。

## 验收标准

1. 「过程日志」中「运行日志」块铺满右侧审阅区剩余高度（无底部大片空白）。
2. 上滚阅读时，轮询/SSE 增量不强制拽回底部；贴底时仍跟随最新行。
3. 运行中不以每 2 秒全文重绘日志；增量到达时仅追加（或等价局部更新）。
4. 任务结束后可一次看到完整历史日志；离开任务或切 slug 时停止 SSE。

## 非目标（Non-goals）

- 不改 Daemon 上游 SSE 协议；不实现节点 stream / chat SSE。
- 不做磁盘级日志持久化；缓存仅会话内存。
- 不新增「暂停滚动」独立开关（贴底语义即可）。
- 不重构其它审阅 Tab 的数据拉取策略。

## Capabilities

### New Capabilities

- `daemon-review-logs-stream`: 过程日志铺满、贴底锁定与 SSE 增量缓存行为

### Modified Capabilities

- （无主 specs 存量；行为落在新 capability）

## Impact

- `src/workbench-layout.css`、`src/workbench.js`
- `src/lib/workbench-daemon-client.js`、新建 SSE 解析纯模块
- `src/ipc/workbench-daemon.js`、`src/preload.js`
- `docs/daemon/README.md`（已用 API 清单补 logs/stream）
- 测试：`tests/workbench-daemon-review.test.js` 等
