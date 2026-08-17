# 硬门禁测试债 — 测试报告

日期：2026-08-17  
Change：`fix-hard-gate-test-debt`

## 命令

| 命令 | 结果 |
|------|------|
| `npm test` | PASS · 1574 pass / 0 fail / 51 skipped |
| `npm run test:renderer` | PASS · 194 pass / 0 fail · 37 files |
| `npm run lint` | PASS（存量 advisory 行数告警） |
| `npm run typecheck:renderer` | PASS |
| `node .cursor/scripts/harness.js gate --json` | PASS |

## 根因与修复（红簇）

1. **Launcher 协议常量未绑定** — `agent-run-launcher-remote` / `port` 使用 `SUPPORTED_PROTOCOL_VERSION` / `BUS_VERSION` 等但未导入；抽 `agent-run-launcher-shared.ts` 作单一真值，adapters/launcher 再导出。
2. **Audit redact 未绑定** — `tool-contract-audit.appendAuditLog` 缺 `redactSensitiveFields` / `createAuditId`；本地实现避免与 governance 循环 require。
3. **`search_web` preview** — `agent-tools-surface` 缺 `MAX_UI_PREVIEW_CHARS`；从 `agent-tools-format` 导出并导入。
4. **capability-hub Vitest** — 规格误用 `wb-mode-tab(s)`；对齐 UI 为 `hub-tab` / `hub-tabs`。

## 备注

本 Story 不改产品行为，只修拆文件漏绑定与过期测试断言。硬门禁绿后可回头归档 main 三轮 change。
