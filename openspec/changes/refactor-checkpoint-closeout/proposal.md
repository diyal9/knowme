## Why

`refactor/renderer-react-ts` 分支已完成 React + TypeScript Renderer 重构，需要一次 **v0.4.0 工程基线收口**：修复已知 P1/P2 阻塞、同步主规格、更新证据，形成可审查的发布候选。不是产品增长版本，不要求薄表面 1:1。

## What Changes

- 同步 `agent-chat-ux` / `agent-run` 主规格：气泡不再提供「应用到文件」（`simplify-assistant-reply-chrome` 正式决策）
- 修复 ContentView source 切换时短暂展示旧 blocks
- LLM HTTP：保留 `ipv4first`，用自定义 lookup 替代 `family: 4`，允许合法 IPv6 Endpoint
- 更新 BACKLOG、交接文档、retro；活跃 change 仅本收口项
- 不实现 BACKLOG 中未交付 epic

## 目标用户

开发 / Codex 接收审查：明确 v0.4.0 能跑什么、测什么、差什么。

## 验收标准

- `npm run check` 全绿；renderer build 成功
- harness gate（本 change）通过；OpenSpec health 通过
- Electron 核心 smoke 通过；`git diff --check` 通过
- 主规格、实现、测试、归档 change 四者关于 apply-to-file 一致
- 验收语义：**v0.4.0 工程基线通过**（非产品 1:1 完成）

## 非目标

- 不 merge develop / 不打 tag / 不 push
- 不规划 v0.5.0 实现
- 不把 restore-game-studio-ui-parity 标完成
