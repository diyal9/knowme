## ADDED Requirements

### Requirement: Persist schedule on workbench tasks

工作台任务 store MUST 支持在任务上持久化定时计划（每天 / 间隔 / 单次）与启用状态，并计算可读标签与下次执行时间。

#### Scenario: Enable daily schedule

- **WHEN** 用户为任务保存启用中的每天计划（含时刻）
- **THEN** 任务持久化 `scheduleEnabled=true`、对应 `schedule`、非空 `scheduleLabel` 与未来的 `nextRunAt`

#### Scenario: Disable schedule

- **WHEN** 用户关闭任务的定时计划
- **THEN** `scheduleEnabled=false` 且 `nextRunAt` 为空

### Requirement: Task home schedule entry

任务首页 MUST 提供「定时任务」入口，用于管理任务级计划，且 MUST NOT 跳转到工作流自动化中心。

#### Scenario: Open schedule panel from task home

- **WHEN** 用户点击任务页「定时任务」
- **THEN** 系统打开任务定时面板（可列出/编辑任务计划），不进入工作流自动化 manage 面板

#### Scenario: Row action opens editor for that task

- **WHEN** 用户在最近任务行点击「定时」
- **THEN** 系统打开该任务的计划编辑界面

#### Scenario: Scheduled badge on row

- **WHEN** 任务已启用计划
- **THEN** 最近任务行展示计划标签（如每天时刻或间隔文案）

### Requirement: Due fire spawns child expert task

App 在运行时，主进程 MUST 周期性扫描到期且已启用的父任务；触发后 MUST 推进父任务下次时间，并通知渲染进程按同一专家与目标创建子任务并启动专家执行。

#### Scenario: Due daily task fires

- **WHEN** 启用每天计划的父任务 `nextRunAt` 已到期且应用在运行
- **THEN** 系统创建带 `scheduleParentId` 的子任务、启动专家对话，并更新父任务的 `nextRunAt` / `lastScheduledAt`

#### Scenario: Once schedule auto-disables

- **WHEN** 单次计划任务被触发
- **THEN** 父任务 `scheduleEnabled` 变为 false，且不再有下次执行时间

#### Scenario: Child tasks are not re-scheduled parents

- **WHEN** 扫描到期任务
- **THEN** 带有 `scheduleParentId` 的子任务不会作为计划源再次触发
