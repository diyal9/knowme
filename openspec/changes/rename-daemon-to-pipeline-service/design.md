## Context

See proposal.md — Why。产品侧已有「团队管线 / 管线记录」叙事，但 UI 仍直出 `Daemon`。

## Goals / Non-Goals

- Goals：用户可见文案统一为「管线服务」；测试断言同步；契约不变。
- Non-Goals：不重命名内部 `daemon*` 标识符 / IPC / CSS。

## Decisions

1. **展示名固定为「管线服务」**  
   - 与「团队管线」「管线记录」同语义场；不采用「团队服务 / 交付引擎」。  
   - 组合规则：`Daemon X` → `管线服务X` 或 `管线服务 · X`（如「管线服务在线」「管线服务 · 只读」）。

2. **标识符保留 daemon**  
   - `data-wb-mode="daemon"`、`workbenchDaemon*`、`daemonOnline` 等不变，避免协议与存储迁移。

3. **兼容旧 AI 输出匹配**  
   - `workspace-agent.js` 中识别「可启动 Daemon 工作流」的正则同时兼容「管线服务」。

## Risks / Trade-offs

- [漏改文案] → 以 `src/**/*.{js,html}` 中含 `Daemon` 的用户串为清单逐项替换，并跑相关测试。  
- [开发文档仍写 Daemon] → 可接受；本变更不清洗历史 OpenSpec。

## Migration Plan

- 纯前端文案，无数据迁移；回滚即还原字符串。

## Open Questions

- （无）
