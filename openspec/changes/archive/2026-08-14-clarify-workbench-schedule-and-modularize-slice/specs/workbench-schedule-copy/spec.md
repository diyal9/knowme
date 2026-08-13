# workbench-schedule-copy

## Purpose

统一工作台「专家任务定时」与侧栏「自动化」的用户可见边界，避免暗示无人值守或云端调度。

## Requirements

### Requirement: Composer schedule boundary copy

任务 composer 的定时区块 MUST 说明：
- 到期会创建新的协作并尝试自动开工；
- 仅在本机 KnowMe 运行时触发；
- 不会代替用户发送消息或无人值守完成对话。

#### Scenario: User enables schedule in composer

- **WHEN** 用户勾选「定时执行」
- **THEN** 可见上述边界说明（toggle 副文案 + 字段区注释）

### Requirement: Task card schedule tooltip

已设定时的任务卡片 clock 标记 MUST 展示计划标签与下次时间，并含「需 App 在线」提示。

#### Scenario: Scheduled parent task in recent list

- **WHEN** 任务 `scheduleEnabled` 为 true 且存在 `scheduleLabel`
- **THEN** tooltip 含计划描述、可选 nextRunAt、在线约束

### Requirement: Automation list honesty

自动化页列表顶 hint MUST 区分：
- 可立即执行 / 可绑定管线的自动化；
- 未绑定可执行管线时计划仅为草稿、不会自动调度（`scheduler_unavailable`）。

#### Scenario: User opens automation page

- **WHEN** 渲染自动化列表
- **THEN** hint 文案不暗示全部计划已自动执行

### Requirement: Composer schedule module

`readTaskComposerSchedule` / `syncTaskComposerScheduleFields` / `resetTaskComposerSchedule` MUST 位于 `src/lib/workbench-task-composer-schedule.js`，由 workbench 薄包装调用。

#### Scenario: Unit test imports module

- **WHEN** Node 测试 require 该模块
- **THEN** 纯函数与 COPY 常量可测，行为与原先内联逻辑一致
