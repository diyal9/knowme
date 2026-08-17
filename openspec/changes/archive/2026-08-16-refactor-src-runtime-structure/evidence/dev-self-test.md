## 2026-08-14 refactor-src-runtime-structure

### 命令与结果

```text
$ npm test
ℹ tests 1613 | pass 1562 | fail 0 | skipped 51

$ npm run test:renderer
Test Files 13 passed | Tests 41 passed

$ npm run typecheck:renderer
(tsc --noEmit -p tsconfig.json — exit 0)

$ npm run lint
architecture ok | lint ok | script-scope ok
```

### 结构变更摘要

| 区域 | 变更 |
|------|------|
| `src/main.js` | 2 行 boot（register-ts + require 组合根） |
| `src/main/index.ts` | vm loader，加载 8 个 chunk（各 ≤380 行） |
| `src/main/chunks/` | 原 3200 行组合根分片 |
| `src/main/load-renderer.ts` / `tray.ts` | 自 `src/main/*.js` 迁 TS |
| `src/ipc/*.ts` | 全量自 `.js` 迁 TS（`ai-generate.ts` 列入 oversize 白名单） |
| `src/preload/` | `index.ts` + `api-core.ts` + `api-extended.ts` |
| `src/domain/` | workbench labels/escape/provenance/run-phase、work-surface |
| 删除 | `src/workbench/*.js`、`src/work-surface.js` |

### 仍留 JS（允许）

- `src/main.js`、`src/preload.js`：薄 boot
- `src/assets/vendor/*`、`src/assets/obsidian-plugin/*`
- `src/ui-icons.js`（测试/遗留 CSS 引用，非运行时主路径）

### 冒烟（逻辑）

- IPC 通道名未改；`registerCoreIpc` 仍从 `src/ipc/index.ts` 注册
- workspace-init 仍可读 notes 目录（兼容 stub，无便签窗）
- 托盘/设置/工作台窗口工厂逻辑在 main chunks 内保持
