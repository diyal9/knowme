## Why

工作流首页货架卡与管理卡上的「输入 / 产出」背景条偏厚（`min-height:30px` + 较大垂直 padding），与编排编辑界面节点摘要行、以及同卡「简要流程」步骤条的紧凑节奏不一致，扫读时中段过重。

## What Changes

- 压矮货架卡与管理卡的输入/产出背景条（降低垂直 padding、去掉偏高 min-height）
- 保持全宽矩形条上下堆叠布局与文案不变
- 货架与管理卡 IO 条继续共用同一套紧凑度量

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workbench-workflow-shelf`: 输入/产出摘要条垂直尺寸须与编排编辑界面摘要行同级紧凑

## 目标用户

在工作流首页扫读官方/个人流程、并与编排编辑界面来回对照的创作者。

## 验收标准

1. 货架卡「输入」「产出」背景条明显变矮，但仍单行可读、不截断关键文案
2. 管理卡 IO 条与货架卡同高同节奏
3. 仍为上下两行全宽矩形条，非 pill 并排

## 非目标（Non-goals）

- 不改 IO 文案内容与截断长度
- 不改简要流程步骤条样式
- 不改编排画布节点内部 DOM 结构

## Impact

- `src/workbench-shelf.css`（`.wb-shelf-chip` / `.wb-workflow-manage-chip`）
- 无 IPC / schema 变更
