## Why

工作台任务页的「自动化」只跳转到工作流定时中心，与「你的任务」无上下文；且现有自动化 Job 必须绑定 Workflow Package，也没有到期自动触发。用户需要的是对专家任务设置重复/定时，并在本机 App 在线时自动再跑一轮。

目标用户：日常把重复性工作交给专家（日报、例会纪要、定期复盘）的桌面用户。

商业化与体验价值：任务页入口与真实能力对齐，减少迷路；定时复跑形成回访与留存钩子，不强迫用户先学工作流编排。

## What Changes

- 工作台任务支持 `daily` / `interval` / `once` 计划字段与启用开关。
- 主进程分钟级扫描到期任务，通知渲染进程创建子任务并拉起专家对话。
- 任务页按钮改为「定时任务」入口；任务行可设定时并显示计划徽章。
- 侧栏「自动化」（工作流自动化中心）保持独立，不改其语义。

验收标准：

- 可为已有专家任务开启每天/间隔/单次计划并持久化。
- 计划启用时任务行显示计划标签；关闭后标签消失。
- App 运行中到期会生成子任务并进入专家执行；父任务保留计划并推进下次时间；`once` 触发后自动关闭。
- 任务页「定时任务」不再跳到工作流自动化中心。
- 关机/退出客户端后不承诺触发（UI 有提示）。

非目标（Non-goals）：

- 不做云端 cron / 系统级后台服务。
- 不改工作流自动化 Job 模型与「立即执行」管线绑定逻辑。
- 不做飞书推送闭环（本期不验收）。

## Capabilities

### New Capabilities

- `workbench-task-schedule`: 工作台专家任务的定时计划、到期触发与任务页入口行为。

### Modified Capabilities

- （无）

## Impact

- `src/lib/workbench-task-store.js`、新建 `workbench-task-scheduler.js`
- `src/main.js`、`src/preload.js`
- `src/workbench.js`、`src/workspace.html`、`src/workbench-layout.css`
- 相关单测与 OpenSpec 证据
