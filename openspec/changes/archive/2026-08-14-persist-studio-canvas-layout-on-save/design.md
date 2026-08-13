## Context

See proposal.md — Why。`toComposition`（`compileFree`）已写出 `layout` 与节点坐标，但：

1. `compileWorkbenchAgentGraph` → `normalizeNode` / `buildComposition` 丢弃 `x`/`y`/`layout`
2. `normalizeGraph`（package store）再次丢弃
3. `saveStudioWorkflow` 落盘 `plan.composition` 后 `fromGraph` 无坐标 → 画布重排，观感像「没保存」

## Goals / Non-Goals

**Goals:** 编辑器布局经 plan → package → fromGraph 完整往返。

**Non-Goals:** 执行引擎消费 layout；线性步骤模式坐标。

## Decisions

1. **三层都保留布局**：agent-graph 归一化、workflow-package 归一化、save 时用 studio `toComposition().layout` 合并进待存 graph（防止任一环遗漏）。
2. **坐标为可选有限数字**：非法值省略，旧包无 layout 仍走自动排布。

## Risks / Trade-offs

- [Risk] compositionHash 因加入 layout 变化 → 可接受（内容本就变更）。
- [Risk] 过大坐标 → 存盘时仍 clamp 到 ≥0（与 `updatePosition` 一致）。
