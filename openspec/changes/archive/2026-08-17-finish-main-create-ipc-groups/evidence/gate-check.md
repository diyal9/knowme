# 门禁检查：finish-main-create-ipc-groups（及 main 三轮）

**门禁名称**：Story 完成门禁  
**触发时机**：/story-done 前 / 关单决策  
**日期**：2026-08-17

| 检查项 | 级别 | 结果 | 证据 |
|--------|------|------|------|
| npm test | 硬 | FAIL | 1625 / pass 1561 / **fail 13**（已从约 49 降下来；仍 BLOCKING） |
| npm run lint | 硬 | PASS | Hub / feishu-cli 行数 WARN |
| npm run typecheck:renderer | 硬 | PASS | |
| npm run test:renderer | 硬 | FAIL | **1** fail：`capability-hub` 期望 `wb-mode-tab`，实为 `hub-tab` |
| 结构/绑定冒烟 | — | PASS | 36 项绿 |
| qa-plan + Smoke Scope | 软 | PASS | `qa-plan.md` |
| code-review | 软 | PASS | `code-review.md` |

**结论**：⛔ **BLOCKING** — 不得 `/story-done`，不得归档 main 三轮 change。

**后续**：实现 `openspec/changes/fix-hard-gate-test-debt`（规划已齐，可 `/opsx:apply`）。

**main 重构关单**：结构目标完成；体验路径按 acceptance 勾选；归档等硬门禁绿后再做。
