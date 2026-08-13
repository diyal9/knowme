## Why

Daemon 运行间把 progress.md / 过程日志投影进左栏对话，导致对话流被系统卡片打断；底部「过程日志」又把焦点拉回对话，排障与对话抢同一条视觉通道。需要把过程日志收进右侧审阅 Tab，让左栏只保留真实对话。

## What Changes

- 在审阅 Tab「事件」之后新增「过程日志」Tab，展示 progress.md 摘要与运行日志
- 停止将过程块（PROGRESS.MD / 运行日志）注入左栏对话流
- 移除底栏「过程日志」按钮；「刷新」移到 Tab 栏最右侧，仅图标
- 原「过程日志」动作改为切换到「过程日志」Tab（若仍有代码入口）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `pipeline-run-review-surface`: 过程日志从对话投影改为右侧独立 Tab；底栏布局与刷新入口调整

## Impact

- `src/lib/workbench-daemon-review.js`：Tab 列表与审阅投影
- `src/workspace.html` / `src/workbench-layout.css`：Tab + 刷新布局
- `src/workbench.js`：渲染 logs Tab、停用对话投影、刷新位置
- `src/workspace-agent.js`：过程 feed 可保留 API 但 Daemon 路径不再写入
- 测试：`tests/workbench-daemon-review.test.js`、`tests/workbench-templates.test.js`

## 目标用户

在工作台查看失败/运行中 Daemon 任务、需要对照日志排障的用户。

## 验收标准

1. 左栏对话不再出现 PROGRESS.MD / 运行日志过程卡
2. 右侧 Tab 顺序为：步骤 · 制品 · 变更 · 事件 · 过程日志
3. 「过程日志」Tab 能看到 progress 与日志内容（或空态文案）
4. 底栏无「过程日志」按钮；刷新为 Tab 栏右侧图标按钮
5. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改管线服务 API 或日志拉取协议
- 不重做左栏「执行过程」助手排障回复文案
- 不调整步骤/制品/变更/事件其它 Tab 业务逻辑
