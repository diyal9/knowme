# 开发自测 — restore-game-studio-ui-parity

日期：2026-08-15

## 门禁（Wave 12 末）

| 命令 | 结果 |
|------|------|
| `npm test` | PASS（1562 pass / 51 skip / 0 fail） |
| `npm run lint` | PASS |
| `npm run typecheck:renderer` | PASS |
| `npm run test:renderer` | PASS（23 files / 98 tests） |

## 助手空态对齐（2026-08-15 追加）

| 项 | 结果 |
|----|------|
| `npx vitest run src/renderer/features/assistant/assistant.spec.tsx src/domain/agent-session.spec.ts` | PASS（21） |
| `npm run typecheck:renderer` | PASS |
| `npm run renderer:build` + 重启 KnowMe（非 baseline worktree） | 已执行 |

对齐点：空态 composer 粉红 focus-within、placeholder「给 KnowMe 发送消息…」、隐藏知识库/快捷按钮、空态不渲染过程条、Tab「通用」+ 头像 + 关闭。

### 实现摘要

| 面 | 改动 |
|----|------|
| **WB-studio IO** | `StudioIoFields` + `domain/studio-io.ts`：入参/出参 `wb-studio-io-row`（字段名、类型、必填、示例、枚举项、增删） |
| **WB-studio knowledge** | `knowledge` 节点 inspector 下拉接 `knowledgeProviderList` IPC；进入 Studio 时 `loadStudioKnowledgeProviders` |
| **A-model Context Usage** | 无独立 token IPC；接现有 `ai-generate` → `ai-stream-event` 的 `contextInfo`（`onAiStreamEvent` preload 已有）；`domain/agent-context-usage.ts` 渲染 ctx2 分区 |
| **A-stream progress** | 同期接入 `onAiStreamEvent` stage title/summary → `assistantStatus` / `assistantProcessLines`（非假数据；daemon 进度仍走 `workbenchDaemonProgress`） |
| **shared/api.ts** | 补 `knowledgeProviderList` / `onAiStreamEvent` / `AiStreamEvent` 类型 |

### IPC 对照（诚实）

| 能力 | f6ad048 | 现 React | Wave 12 结论 |
|------|---------|----------|--------------|
| Context Usage 分区 | `ai-stream-event` stage 内 `contextInfo` | 同上，已接线 | **无**独立 `agentContextUsage` IPC；未造假数据 |
| 助理 progress | stage/tool 事件 | `onAiStreamEvent` | **无**独立 progress IPC 到助理列；daemon 仍用 `workbenchDaemonProgress` |
| Studio knowledge 下拉 | `knowledgeProviderList` | 已接 | 对齐 |
| 会话 knowledge 菜单 | provider catalog | wiki/okf 列表 | **仍未** 1:1（非 Studio 范围硬差） |

### UI 对照

| 方式 | 结果 |
|------|------|
| Vitest DOM | Studio IO / knowledge select / context usage 单测通过 |
| Vite preview + Playwright | 更新 `evidence/screenshots/react/react-assistant.png`、`react-workspace.png`、`react-settings-about.png` |
| Electron 真机 | **未签字** — Playwright 无法打开 Electron 壳；preview 无 `window.api` 仅壳层 |

### Wave 12 后仍无法 1:1（硬限制 / 架构）

- **W-note / W-list**：独立便签 — 禁止还原
- **S-files 分屏/版本**：disabled 降级（退役独立编辑器）
- **A-knowledge 会话菜单**：仍用 wiki/okf，非 f6ad048 provider catalog 全量
- **A-stream chunk 动画 / SSE 像素**：仍简
- **WB-search 全站 IPC / WB-auto cron**：无 IPC 或刻意未做
- **Studio agent 模式**：simpleMode 技能多选 / 去专家库调优 — 未在本 change 范围
- **Electron 像素级对照**：需本地 `npm start` 人工对照 baseline

**结论：核心路径已尽量对齐；剩余项为硬限制或需新 IPC/架构，Wave 12 后不再开 Wave 13 清单。**

## Wave 11（2026-08-15）

（见 git history）

## Wave 10（2026-08-15）

（见 git history — 自动化全字段 / H-picker / tab-ctx / daemon feed / studio 密度）
