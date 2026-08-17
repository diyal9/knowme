## Context

`scripts/architecture-lib-oversize.json` 为存量 `src/lib` 超限文件的 shrinking-only 白名单。本 change 只迁结构。

## Goals / Non-Goals

**Goals:** 按域切开；原模块导出不变；达标即删白名单。
**Non-Goals:** 改行为；用 vm concat 规避 400 行。

## Decisions

1. **兼容入口**：优先把内聚块抽到 `src/lib/<name>-<concern>.ts`，原文件 `require` 并 re-export。调用方不改路径。
2. **域目录**：connectors 已在 `src/lib/connectors/`；飞书 CLI 继续拆在该目录。不把规则复制进 `src/domain`。
3. **白名单**：文件 ≤400 则删除该键；仍超限则把 JSON 中的行数改为当前行数（只许更小）。
4. **禁止** `@ts-nocheck`、新增 `.js`、把 DOM 塞进 lib。

## Electron 边界

Renderer → `window.api` → `src/ipc` → `src/lib`。拆文件不新增 IPC、不让 renderer require lib。

## 分波

1. 刚过 400 的文件（catalog / scheduler / launch-model / web-fetch / process-tools / mcp-host / bootstrap / feishu-auth）一次拆出白名单。
2. 中型（500–900）：agent 工具、workbench daemon、product-memory。
3. 大型（1000+）：hub-service、studio-model、run-executor/manager、package-runtime、feishu-cli。
