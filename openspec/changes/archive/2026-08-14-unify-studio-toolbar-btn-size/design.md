## Context

See proposal.md — Why。顶栏按钮已用 `.wb-studio-tool-btn`（标称 30×30），但 flex 默认 `min-width:auto` 与 Lucide 24 viewBox 图标可能导致个别按钮外框或图标观感不一致。

## Goals / Non-Goals

**Goals:** 用固定盒模型锁定外框与图标尺寸。  
**Non-Goals:** 不改交互与图标语义。

## Decisions

1. **固定 30×30 + `flex: 0 0 30px` + `overflow:hidden`**  
   防止内容撑开。备选：改用 28×28 — 保持现有 30 不动。

2. **图标统一 15×15，`svg { display:block }`**  
   消除基线空隙导致的视觉偏移。

## Risks / Trade-offs

- [图标过密] → 15px 在 30 盒内留白足够

## Migration Plan

纯 CSS；回滚还原规则即可。
