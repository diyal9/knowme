## Why

Daemon 任务创建后常因缺少 slug、未做 CLI/执行器预检、或步骤投影依赖 KnowMe 本地内容源而失败或「流程详情暂不可用」。创建表单需要在启动前可感知就绪状态，步骤定义应以管线服务（Daemon 安装目录）为准。

## What Changes

- 启动任务时自动生成与时间关联的合法 slug
- 创建表单增加执行器 / CURSOR_API_KEY 预检（需 CLI 的工作流）
- Daemon 任务步骤投影优先从管线服务安装目录加载 workflow 定义，不再依赖本地内容源
- 失败态与任务事实摘要对齐，避免「失败」却提示已完成

## Capabilities

### New Capabilities

- `daemon-launch-preflight`: 启动前预检、时间 slug、Daemon 侧 workflow 投影

### Modified Capabilities

- `agent-workbench`: Daemon 创建与任务工作间投影来源

## Impact

- `src/lib/workbench-daemon-client.js`、`workbench-daemon-surface.js`、`game-workbench-handoff.js`
- `src/lib/workbench-task-projection.js`、`workbench-task-brief.js`、`workbench-repo.js`
- `src/main.js`、`src/workbench.js`
- 相关单测
