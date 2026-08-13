## Context

任务持久化在 `workbench-tasks.json`；专家执行走渲染侧 `beginExpertTask`。现有 `workbench-automations.json` 面向工作流 Package，且无到期 tick。本 Story 把调度挂在 task-store，主进程只负责 due 判定与通知，执行仍走既有专家任务路径。

## Goals / Non-Goals

**Goals**

- 任务级 schedule 持久化与 UI 配置。
- 本机 App 在线时到期触发：复制子任务 → `beginExpertTask`。
- 任务页入口与「你的任务」串联。

**Non-Goals**

- 云端调度、关机后台、飞书推送验收。
- 改造工作流自动化中心。

## Decisions

1. **Schedule 挂在 task**：字段 `schedule` / `scheduleEnabled` / `scheduleLabel` / `nextRunAt` / `lastScheduledAt` / `scheduleParentId`。
2. **触发模型**：父任务保留计划；每次 due 创建子任务（`scheduleParentId`），避免覆盖父任务会话历史。
3. **主进程 tick 60s**：先 `advanceAfterFire` 持久化，再 `webContents.send('workbench-task-schedule-due')`，避免重复触发。
4. **once**：触发后 `scheduleEnabled=false` 且清空 `nextRunAt`。
5. **UI**：`#wbTaskAutomation` 文案「定时任务」；打开任务定时弹层；侧栏自动化不动。

## Risks / Trade-offs

- 渲染进程未就绪时可能丢一次触发 → tick 已 advance，下次不会重发；可接受（MVP），后续可加重试队列。
- 分钟粒度有最多约 60s 延迟 → 与本地桌面产品预期一致。

## Migration Plan

旧任务无 schedule 字段时 normalize 为未启用；无需迁移脚本。

## Open Questions

无。
