# 测试报告: finish-main-create-ipc-groups

## 门禁
- [硬] npm test: FAIL（1625 / pass 1561 / fail 13；另开 `fix-hard-gate-test-debt`）
- [硬] npm run lint: PASS（Hub / feishu-cli 行数 WARN）
- [硬] npm run typecheck:renderer: PASS
- [硬] npm run test:renderer: FAIL（1：capability-hub `wb-mode-tab`；另开 `fix-hard-gate-test-debt`）
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果
| 用例 | 结果 | 备注 |
|------|------|------|
| `npm start` 主进程 | PASS | 2026-08-17 再验 `KnowMe 主进程启动` |
| 绑定/结构守卫 | PASS | 36 项：generate free-idents、grounding split、output-protocol redact、ipc-helper、split-entry、architecture-sweep |
| 助理生成路径 | PASS | 漏绑定修复后上轮真机 `llm/first-token`；本轮窗口已拉起 |
| 设置/日志 Vite | PASS | 见 evidence/screenshots/ |

## 反模式发现
- 结构：无 `part-*`、`scope.ts`、`attach(`、vm concat。
- 会话中补漏：`connectorToolRuntime`、`requestAgentCompletion`、`EXECUTION_CLAIM_RE`、`REDACT_KEY_PATTERN`。
- ### [ADVISORY] 全量单测与 Vitest 红
  - 与 main 命名模块无关；阻塞 `/story-done` → `fix-hard-gate-test-debt`

## 结论
- [x] 结构+体验路径通过（可停 main 重构）
- [ ] 不得 story-done / 不得归档三轮 main change（硬门禁 FAIL）

证据目录：evidence/screenshots/
