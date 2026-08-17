# Proposal: split-capability-hub-service-by-domain

## 问题

`src/lib/capability-hub-service.ts` 约 1699 行，超过架构 1200 行告警阈值。映射层已抽到 `capability-hub-map.ts`，但 service 内仍重复一份，且 Hub 工厂（生命周期、专家、会话上下文、IPC）全部堆在同一文件。

## 目标

按域拆到 `src/lib/capability-hub/`，组合根 `capability-hub-service.ts` ≤900 行（硬顶 ≤1200），**对外 require 路径与 `module.exports` 符号不变**。

## 范围

- 接线 `capability-hub-map.ts`（迁入 `capability-hub/map.ts` 并 re-export 兼容）
- 新增：`lifecycle.ts`、`experts.ts`、`session-context.ts`、`runtime.ts`、`ipc.ts`
- 纯重构，不改产品行为 / IPC 通道名

## 非目标

- 不改 main specs（或极薄 delta）
- 不引入共享神对象 ctx
- 不改 renderer / preload 调用方
