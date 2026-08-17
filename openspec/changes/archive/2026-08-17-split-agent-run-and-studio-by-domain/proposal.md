# Proposal: split-agent-run-and-studio-by-domain

## 问题

`agent-run-executor.ts`（~1089 行）与 `agent-run-manager.ts`（~1049 行）接近架构 1200 行告警阈值，执行相位与状态机逻辑堆在同一文件，不利于按域维护与 review。

`workbench-studio-model.ts` / `workbench-studio-canvas.ts` 已是 model/canvas 两域分离；需评估是否存在第二套独立变化原因。

## 目标

1. **Agent Run（优先）**：按执行相位 / 状态机域拆到子目录，组合根保留对外 API 与 `run()` 编排。
2. **Studio（条件）**：仅在确有第二套变化原因时轻拆；否则在 design 中明确不作。
3. **硬约束**：不改 Run 状态机语义、输出协议、IPC；对外 require 路径与导出符号不变；禁止共享神对象 `ctx`；各新文件 ≤800 行。

## 范围

- `src/lib/agent-run-executor/` + 瘦身组合根
- `src/lib/agent-run-manager/` + 瘦身组合根
- Studio：评估后按 design 决策执行或跳过

## 非目标

- 不改 renderer / preload / IPC 通道
- 不为行数硬锯 Studio UMD  bundle
- 不改变 Agent Run 行为语义
