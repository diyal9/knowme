# Deferral: workbench task schedule + automation

**Date:** 2026-08-12  
**Decision:** 定时任务（专家任务 schedule）延后，与侧栏「自动化」一并规划/实现，本阶段不再单独补齐。

## Why

- 当前 schedule 后端可 tick，但体验不完整（不自动发送、失败易漏跑、管理入口弱）
- 与工作流「自动化」语义易混；拆开做会重复入口与模型

## Current state (frozen)

- 新建任务弹窗可勾选「定时任务」写计划；主进程分钟 tick 仍在
- 任务页独立「定时任务」Hub 已去掉，改为「管理最近任务」
- 侧栏自动化仍是 Workflow Job 模型（常 `scheduler_unavailable`）

## Later scope (when combined)

- 统一入口与命名（任务定时 vs 工作流自动化）
- 到期执行成功后再推进计划；可选自动发送目标
- 已有计划的改/关管理
- 明确本机在线约束文案

## Related OpenSpec

- `openspec/changes/enable-workbench-task-schedule/` — 原定时 Story
- `openspec/changes/refine-task-home-composer-and-manage/` — 去掉 Hub、composer 体验
