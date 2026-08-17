# Code Review: fix-hard-gate-test-debt

## 范围
- `agent-run-launcher-shared.ts` + adapters/remote/port/launcher 常量单一真值
- `tool-contract-audit` 本地 redact / auditId（避环）
- `agent-tools-format` 导出 `MAX_UI_PREVIEW_CHARS` → surface
- capability-hub 规格 class 对齐 UI

## 结论
- [x] **通过**：无产品行为变更意图；修复拆文件漏绑定与过期 Vitest 断言
- 风险：shared 与 adapters 再导出需保持同步（已由 Node 套件覆盖）
- 复核：2026-08-17 harness 硬门禁 PASS
