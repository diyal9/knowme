# 开发自测报告

- 日期：2026-08-13
- Change：`split-entry-ipc-workbench`
- npm test: PASS（1786/1786）
- npm run lint: PASS
- 手动冒烟: 制作人/测试按合同+回归验收通过（见 acceptance.md / evidence/test-report.md）
- 归档：`openspec/changes/archive/2026-08-13-split-entry-ipc-workbench/`
- 主规格已同步：`openspec/specs/entry-modularization/spec.md`

## 落地（IPC 切片 I–N）

| 步 | 模块 | 通道 |
|----|------|------|
| I | `workspace-state.js` | get/save-workspace-state |
| J | `workspace-init.js` | workspace-init |
| K | `build-final-prompt.js` | build-final-prompt |
| L | `note-layout.js` | note-set-ai-mode |
| M | `note-context-menu.js` | show-context-menu + show-list-context-menu |
| N1 | `ai-assist.js` | ai-suggest-title + ai-cancel-run |
| N2 | `agent-output-fixture.js` | agent-output-fixture-run（env 门控） |
| N3 | `ai-generate.js` | ai-generate（~1640 行；lib require + main deps 注入） |

## main.js 变化

| 阶段 | 行数 | 内联 ipcMain |
|------|------|--------------|
| 切片 F 后 | ≈5661 | 大量 |
| G–H6 后 | ≈5228 | 11 簇 |
| **I–N 后** | **3337** | **0**（全部经 `registerCoreIpc`） |

## 测试

- `tests/split-entry-ipc-workbench.test.js`：I–N 合同测试 + main 无内联 handler 断言
- `tests/helpers/main-ipc-bundle.js`：存量静态测试改查 main + ai-generate/ai-assist/fixture
- 更新 10+ 存量测试文件（agent-streaming、capability-integration 等）

## 边界说明

- `ai-suggest-title` / `ai-cancel-run` 与 `ai-generate` **非连续**（中间有 compileWorkbenchAgentGraphPayload 等 helper），故分 `ai-assist.js` 与 `ai-generate.js`
- `agent-output-fixture-run` 为独立 test-seam 簇 → `agent-output-fixture.js`
- helpers（buildFabricCtx、buildEmbedFn、buildMissingResourceHint 等）仍留 main，经 deps 注入

## 剩余

**无内联 IPC 簇**；change 可进入制作人验收 / `/story-done` 归档阶段。
