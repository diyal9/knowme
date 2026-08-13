# 开发自测报告

- 日期：2026-08-13
- Change：establish-knowme-evals-system
- npm test: **1875 pass / 1 fail**（失败项为既有 `workbench-daemon-surface.test.js`，与本次 eval 改动无关）
- eval 专项测试: **13/13 PASS**（conversation-eval + eval-suites + agent-benchmark）
- npm run lint: **lint ok**（script-scope 既有重名警告，非本次引入）
- L0 `hard-offline`: **10/10 PASS**（原 8 场景 + 2 新场景）
- L1 `self-e2e-controlled`: **18/18 PASS**（advisory）
- L2 `core-10` benchmark: KnowMe **10/10**；Cursor/Workbuddy **BLOCKED**（适配器骨架）
- 手动冒烟: PASS（离线脚本可执行，evidence 已落盘）

## 命令记录

```bash
node .cursor/scripts/harness.js preflight --json          # ok
npm run eval:l0                                           # 10/10
npm run eval:l1                                           # 18/18 advisory
npm run eval:benchmark                                    # knowme 10/10, cursor/workbuddy blocked
node --test tests/agent-conversation-eval-harness.test.js tests/eval-suites.test.js tests/agent-benchmark.test.js
```

## 证据

- `evidence/eval-report.json` / `.md` — L0 hard-offline
- `evidence/benchmark-report.json` / `.md` — L2 core-10
