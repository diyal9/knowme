# 开发自测报告

- 日期：2026-08-06
- Change：`harden-workbench-tool-surface-runtime`
- Preflight：`node .cursor/scripts/harness.js preflight --json` → **PASS**

## 硬门禁

| 命令 | 结果 | 数量 |
|---|---|---|
| `npm test` | **PASS** | 1107 tests, 0 fail |
| `npm run lint` | **PASS** | lint ok + script-scope ok |
| `node .cursor/scripts/harness.js gate --json` | **PASS** | blocking: false |
| `npx openspec validate harden-workbench-tool-surface-runtime --strict` | **PASS** | change valid |

## 加固专项

| 套件 | 结果 | 用例数 |
|---|---|---|
| `tests/harden-tool-surface.test.js` | **PASS** | 38 |
| `evidence/tester-harden-anti-pattern-checks.js` | **PASS** | 16/16 |
| `evidence/cancel-subrun-electron-smoke.js` | **PASS** | cancel ≤3s mock |
| `evidence/harden-tool-surface-electron-smoke.js` | **PASS** | resolver + blocked host |

## Phase Gates

见 `evidence/phase-gates.json`：P1–P3 全部 **PASS**

## 真实环境 SKIP

| 脚本 | 条件 | 结果 |
|---|---|---|
| `manual-feishu-apply-probe.js` | 无 `FEISHU_CONFIG` | **SKIP**（未伪造 PASS） |
| `manual-playwright-mcp-probe.js` | 无 `MCP_DIR` | **SKIP**（未伪造 PASS） |

## 13 项 Review 覆盖摘要

- **H1** `resolveToolSurfaceForRun` 生产热路径 + Registry envelope/audit
- **H2** `ai-cancel-run` → `cancelSubRun` + 子 Run Map 清理
- **H3** `start_process` shell:false + sandbox 策略 + 注入负例
- **M1** blockedHosts/RFC1918 硬 `scope_denied`
- **M2** IPC strip fakeApply + `KNOWME_TEST_SEAM` / npm test lifecycle
- **M3** Draft CAS `pending→applying→applied|failed`
- **M4** move 双向 rollback
- **M5** mkdir 低风险直建 + 时间线文案
- **M6** process/artifact/runStates TTL+LRU
- **L1** audit hash chain + 脱敏
- **L2** path-security realpath/lstat
- **L3** 批准 IPC 单实现 + legacy 代理
- **L4** 审批卡 summary/loading/rollback + Hub Playwright 链接

## 活跃 change 隔离

未修改其他 6 个活跃 change 的专属工件路径。

## 备注

- 开发阶段完成；**制作人验收**与**正式 QA**待后续门禁。
- 手动冒烟 Electron UI 由制作人/测试在真机执行。
