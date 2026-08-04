# Spec: Agent Run Plan & Self-Verify

## Purpose

为本地 Agent Run 增加持久计划状态、按计划有限扩展执行预算，以及基于计划完成度的自验证收敛。

## Requirements

### Requirement: Persistent structured plan on Run

Run MUST 支持可选 `plan` 字段；缺少 `plan` 的旧 Session MUST 仍可正常打开。`plan` MUST NOT 复用 `steps` 作为计划状态。

#### Scenario: Legacy session without plan

- **WHEN** 打开无 `plan` 的旧 Session
- **THEN** 行为与升级前一致，不报错

#### Scenario: Normalize plan items

- **WHEN** 写入含 status/title 的 plan items
- **THEN** 规范化后 status 仅允许 pending|doing|done|blocked，条数有上限

### Requirement: update_plan tool

在工具启用的 tier，系统 MUST 提供 `update_plan`，允许模型创建或更新计划条目与状态。

#### Scenario: Upsert and set status

- **WHEN** 模型调用 `update_plan` 设置条目为 done 并附 evidence
- **THEN** `run.plan` 更新并返回可读 checklist

### Requirement: Plan injected into dynamic context

当 `run.plan` 非空时，系统 MUST 将精简 checklist 注入动态上下文高优先级段落。

#### Scenario: Plan section present

- **WHEN** plan 含至少一条 pending/doing
- **THEN** 动态上下文包含计划清单，且段落预算受控

### Requirement: Limited dynamic budget expansion

assist/retrieval MUST 可在计划未完成且无重复调用时有限扩展 maxRounds/maxToolCalls；chat MUST NOT 扩展。扩展 MUST 有硬顶与扩展次数上限。

#### Scenario: Expand while plan remains

- **WHEN** plan 仍有 pending/doing，且未触顶、未重复调用
- **THEN** 允许扩展预算并继续循环

#### Scenario: Chat never expands

- **WHEN** tier 为 chat
- **THEN** 工具预算保持基础值

### Requirement: Self-verify before finalize

系统 MUST 在收敛前评估 plan 完成度：全部 done → 正常 finalize；有 blocked/pending 且可扩 → 继续/扩预算；否则 finalize 并给出未完成说明。写入产物 MUST 仍需用户审阅接受。

#### Scenario: Partial finalize

- **WHEN** 预算耗尽且仍有 pending
- **THEN** 最终答复说明未完成项，且不自动写盘

### Requirement: Checkpoint persistence

工具轮次中 plan 变更后，系统 SHOULD 节流持久化 Session，使崩溃后可恢复最近 plan。

#### Scenario: Throttled save

- **WHEN** 同一轮多次更新 plan
- **THEN** 不会对每次更新都立即全量写盘（节流）
