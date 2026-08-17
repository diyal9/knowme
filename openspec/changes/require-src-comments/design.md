## Context

生成主路径拆分后缺职责注释；仓库无强制注释约定。本设计只加约定与示范注释，不改运行时。

## Goals / Non-Goals

**Goals:**
- Cursor always-apply rule：文件头、重要导出函数、非显而易见常量
- 架构文档 MUST 指向该约定
- 生成主链路 7 个模块补齐三类注释（短、写边界与为什么）

**Non-Goals:**
- 全库回填
- 注释 lint 硬门禁
- 改 IPC / 生成逻辑

## Decisions

1. 新 rule `.cursor/rules/source-comments.mdc`（globs `src/**`），`architecture.mdc` 只加一条 MUST 指向它
2. 注释语言：中文；禁止复述代码、禁止小说式 JSDoc
3. 示范范围固定为：`ai-generate.ts`、`agent-generate-{libs,prepare,tool-surface,execute,child-ports}.ts`、`agent-context-orchestrator.ts`
4. 渲染层纯 UI 组件同样适用 rule，但本 Story 不回填

## Risks / Trade-offs

- 存量大量文件仍无头注释 → 靠 rule 约束增量，不全库刷
- 注释过长会涨文件行数 → 硬性「短」：文件头 ≤8 行，函数 1～4 行

## Migration Plan

无运行时迁移。后续改 `src/` 时按 rule 补注释。

## Open Questions

无
