## Context

Agent 空状态在 `workspace.html` 提供首屏静态模板，并由 `workspace-agent.js` 在会话清空时动态重绘。Capability Hub CTA 在两处重复存在，并通过同一事件委托打开 Hub。

## Goals / Non-Goals

**Goals:**

- 同时移除静态和动态空状态 CTA
- 保留四个工作任务入口
- 保留左侧 rail 与设置页的 Hub 入口

**Non-Goals:**

- 不改变 Capability Hub 或 Agent 会话逻辑
- 不调整任务卡片布局

## Decisions

- 同步删除两处 CTA 模板，避免初始 HTML 与动态重绘状态不一致。
- 删除仅匹配 `[data-capability-hub]` 的空状态事件分支，避免遗留死代码。
- 变更仅限 Electron 渲染进程；主进程、preload、IPC、启动性能和内存均不受影响。

## Risks / Trade-offs

- [能力入口发现性降低] → 左侧 rail 保留持续可见的统一“能力”入口，设置页仍有入口
- [静态与动态模板遗漏一处] → 测试同时断言 HTML 与 JS 均无 CTA 文案/属性
