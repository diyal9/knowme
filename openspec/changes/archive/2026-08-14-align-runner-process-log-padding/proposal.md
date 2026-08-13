## Why

非 Daemon 运行面中，「过程日志」挂在 `.wb-task-context` 外侧，缺少与上方「当前状态 / 任务追溯 / 参与专家」相同的水平内边距，标题与日志区贴左，破坏右栏信息层级对齐。

## What Changes

- 为 `.wb-runner-log-section` 补齐与 `.wb-task-context` 一致的水平内边距（14px）。
- 将过程日志内容区改为 inset 卡片（圆角 + 描边），不再全宽贴边 footer 条。
- 必要时同步 `workbench-console.css` 覆盖，避免旧背景规则冲掉对齐。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`：任务运行面「过程日志」分区 MUST 与同栏上方分区标题左缘对齐。

## 目标用户

- 在工作台查看本地/专家图工作流运行进度的知识工作者。

## 验收标准

- 「过程日志」标题左缘与「参与专家」「任务目标」等分区标题对齐。
- 日志内容区不再贴卡片左缘；与上方内容块视觉节奏一致。
- Daemon 审阅面（`is-daemon-review`）行为不变（该区仍隐藏遗留 log section）。

## 非目标（Non-goals）

- 不改日志内容生成、折叠交互或 Daemon「过程日志」Tab。
- 不重做双栏布局或移动 DOM 到滚动容器内（保持底部固定分区）。

## Impact

- `src/workbench-layout.css`、`src/workbench-console.css`
- 契约测试（如有 runner 布局静态断言）
