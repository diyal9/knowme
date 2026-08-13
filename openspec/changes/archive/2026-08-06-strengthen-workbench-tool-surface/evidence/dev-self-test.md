# 开发自测报告 — strengthen-workbench-tool-surface

- **日期**：2026-08-06
- **Change**：strengthen-workbench-tool-surface
- **角色**：开发

## 硬门禁

| 命令 | 结果 |
|---|---|
| `node .cursor/scripts/harness.js preflight --json` | PASS |
| `npm test` | PASS（全量 `tests/*.test.js`） |
| `npm run lint` | PASS |
| `node .cursor/scripts/harness.js gate --json` | PASS（hard: test + lint） |
| `openspec validate strengthen-workbench-tool-surface --strict` | PASS |

## 新增/扩展测试

| 套件 | 用例数（约） | 结果 |
|---|---|---|
| `tests/tool-contract-registry.test.js` | 16 | PASS |
| `tests/agent-file-tools.test.js` | 13 | PASS |
| `tests/agent-process-tools.test.js` | 5 | PASS |
| `tests/agent-artifact-tools.test.js` | 5 | PASS |
| `tests/fake-feishu-write.test.js` | 10 | PASS |
| `tests/mcp-http-transport.test.js` | 5 | PASS |
| `tests/browser-mcp-adapter.test.js` | 6 | PASS |
| `tests/agent-orchestration.test.js` | 4 | PASS |
| `tests/tool-surface-closed-loop.test.js` | 1（5 步闭环） | PASS |

## Phase Gate

见 `evidence/phase-gates.json` — P1~P4 硬门禁均 PASS（fake 环境）。

## Eval

- `evidence/tool-surface-eval.json`：closedLoopPass / externalWriteBlocked / contractCoverage = 1.0
- Fixture：`tests/fixtures/agent-eval/tool-surface-closed-loop.json`

## Electron Smoke（自动化子集）

```bash
node openspec/changes/strengthen-workbench-tool-surface/evidence/tool-surface-electron-smoke.js
```

结果：PASS（审批卡/artifact/preload IPC 静态校验）

## Feature Flag

- `KNOWME_TOOL_SURFACE=v1`（默认）：全量新工具
- `KNOWME_TOOL_SURFACE=legacy`：仅只读文件 + 原有 Feishu draft 路径

## 未能自动验证（需人工 / 凭据）

| 项 | 原因 |
|---|---|
| Windows 真机 Playwright MCP browser_snapshot | 需用户安装 Playwright MCP |
| 真飞书授权 apply 路径 | fake 测试覆盖 draft；真实 API 见 `evidence/windows-smoke.md` |
| Electron 运行时 UI 像素级验收 | 静态 smoke 通过；制作人需 `npm start` 体验审批卡 |
| Capability Hub MCP 安装指引 UI（4.5） | Hub 文案/health 部分依赖现有 capability-hub；Playwright 安装指引见 windows-smoke |

## 活跃 change 隔离

未修改以下 6 个活跃 change 的工件路径：`align-workbench-workflow-catalog`、`feishu-connection-empty-state`、`launch-dialog-progressive-disclosure`、`load-agent-experts-from-daemon`、`polish-link-preview-toolbar`、`restore-unified-knowme-brand-icon`。

## 备注

- 写操作统一经 `tool-drafts.json` v2 + 审批 IPC
- 外部写默认拦截：fake spy 断言 0 次真实 Feishu CLI 写（未 approve）
- 进程 cancel 与 Run cancel 联动已实现（`ai-cancel-run` → `cancelProcessesForRun`）
