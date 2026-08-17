## Context

`check-architecture.js` 曾对所有 `src/**/*.{ts,tsx}` 以 400 行为 ERROR。这与「一块内聚能力可以稍长」冲突。告警线也不应等同于「该切文件」。

## Goals / Non-Goals

**Goals:** 机器拦「过于庞大」；人读规范拦错误拆分。优先级：单一职责 > 模块化 / 组件化 > 行数。1200 行只提醒「是否仍是一个变化原因」。
**Non-Goals:** 自动检测内聚；一次拆完 Hub/飞书。

## Decisions

1. **告警线 1200**：超过则 `WARN:` 打到 stderr，`process.exit` 仍 0（若无其它 ERROR）。
2. **硬顶 2000**：超过则 ERROR，除非 `architecture-lib-oversize.json` 有该路径且上限 ≥ 当前行数。白名单只许缩小、不许新增键（新文件必须先按职责拆域再合入）。
3. **拆分准则（规范，非机器）**：有第二套变化原因才拆；禁止为过行数做 `ctx` 神对象、prototype 外挂、半截 `require` 头。模块化、组件化是职责分叉之后的手段。
4. **Electron**：不改 IPC；不让 renderer require lib。

## Risks

| 风险 | 缓解 |
|------|------|
| 有人把 1999 行继续堆职责 | 规范 + code review；1200 WARN 仍会出现 |
| 白名单 feishu-cli 继续涨 | shrinking-only 硬拦 |
