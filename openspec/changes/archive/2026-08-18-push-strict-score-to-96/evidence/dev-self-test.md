# 开发自测 — push-strict-score-to-96

- 日期：2026-08-18
- change：`openspec/changes/push-strict-score-to-96/`

## 硬项

| 项 | 结果 |
|----|------|
| `npx tsc --noEmit -p tsconfig.json` | PASS |
| `npx vitest run --config vitest.config.ts` | PASS 45 files / 241 tests |
| `node scripts/strict-perf-bench.js` | PASS `before=611936` `after=146154` `ratio=0.2388` |
| `npm run lint` / `npm test` | 见同目录 `test-report.md`（本轮已跑 renderer+tsc） |

## 第 1 波 · 对照证据

### 性能

- 脚本：`scripts/strict-perf-bench.js`（`npm run perf:strict-bench`）
- 基线 `f6ad048`：`workspace.html` + `workspace-agent.js` = **611936** bytes
- 当前助理首屏静态 CSS = **146154** bytes（约基线的 **23.9%**）
- 长列表：`assistant-virtuoso.spec.tsx` — ≤40 静态列表；**100 条走 `agent-message-virtuoso`**
- 诚实边界：本轮是字节对照 + Virtuoso 契约，**不是**同机 Electron 冷启动毫秒 / FPS

### 体验

- 助理主路径单测：`assistant.spec.tsx` 28/28
- 对照截图（不复制大 PNG，引用存量路径）：
  - 基线：`openspec/changes/restore-game-studio-ui-parity/evidence/screenshots/baseline/baseline-assistant.png`
  - React：`openspec/changes/restore-game-studio-ui-parity/evidence/screenshots/react/react-assistant.png`
- 已归档（任务无 `- [ ]`）：`restore-assistant-dialogue-parity`、`restore-assistant-conversation-parity`、`restore-assistant-agent-runtime`
- 诚实缺口仍在 `restore-game-studio-ui-parity`（便签分屏/版本编辑器、真机像素未新签），**禁止归档**

## 第 2 波 · 工程收口

- `src/renderer/app/surface-registry.tsx`：测试顶层 await；生产 `lazySurface`
- `AppShell.tsx`：只 import 注册表并路由；无 `lazySurface(` / `ensureSurfaceCss`
- `lazySurface<P extends object>`：无 `any`；Run/Settings 带 props 泛型
- OpenSpec：任务已全勾且无诚实缺口的 change 已进 `archive/2026-08-18-*`；活跃约 17（含本 change 与未勾项）
- 债：仓库根 `.tmp-*` 已清

## 可重复命令

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run --config vitest.config.ts
node scripts/strict-perf-bench.js
node scripts/openspec-health.js
```
