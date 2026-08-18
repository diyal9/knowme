# 测试报告 · restore-workflow-studio-entry-parity

日期：2026-08-17

| 命令 | 结果 |
|------|------|
| 相关 vitest（manage/studio/shelf/shelf.domain） | PASS 34 |
| `npm run lint` | PASS |
| `npm run typecheck:renderer` | PASS |
| 全量 `npm run test:renderer` | 1 失败：capability-hub 期望 `wb-mode-tab`（既有 UI class，非本 change） |
| 全量 `npm test` | 既有失败：SUPPORTED_PROTOCOL_VERSION / audit jsonl / web-search 等，非本 change |
