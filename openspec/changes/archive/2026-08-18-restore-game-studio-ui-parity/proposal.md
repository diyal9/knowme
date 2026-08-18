## Why

React/TS 重构后，工作台观感与能力接线明显薄于重构前最后产品快照。用户对照的是已推送分支 `feature/game-studio-work-partner`（`f6ad048`），不是 git `main`（便签初版）。现在要把该版本的 **功能与 UI 一比一还原**，实现仍走现行 React/feature/domain/IPC 架构，禁止把 `workbench.js` 贴回去。

## What Changes

- 以 `f6ad048` 为唯一产品对照基线：交互、动作、特效、样式、图标、尺寸、层级。
- 补齐主进程/preload 已有、React 未接的能力（Daemon 观测、Session 持久化、专家库写操作、任务房间全套、Studio 画布、文件中心编辑等）。
- 补齐 `src/shared/api.ts` 与 preload 的类型对齐；修 `agentFileCatalog` 等 UI 超前于 IPC 的缺口。
- 建立可勾选的界面清单与像素对照证据（截图 + Playwright），按波次交付。
- **不还原**独立便签窗 / 总览 / 便签备份（架构宪章已退役便签产品面）。基线里便签相关入口在工作台中隐藏或改走内容源。

## Capabilities

### New Capabilities

- `game-studio-ui-parity`: 相对 `f6ad048` 的工作台、助理、次要窗、专家库的视觉与交互对等（非代码回退）。
- `game-studio-capability-wiring`: 基线已有、现行 IPC/lib 仍在、React 未接线的产品能力补齐。

### Modified Capabilities

- （无主库 `openspec/specs/` 需求变更；本 change 用 delta specs 描述对等行为。）

## Impact

- `src/renderer/features/**`、`src/renderer/app/**`、`src/renderer/styles/**`
- `src/shared/api.ts`、`src/preload/**`（类型与死通道清理）
- 既有 `src/ipc/*.ts` / `src/lib/*.ts`：优先接线，语义与 `f6ad048` 一致；缺能力才补 IPC
- 证据：`openspec/changes/restore-game-studio-ui-parity/evidence/`
- 对照源：`git show f6ad048:src/workspace.html` 等，运行时仍禁止加载页面级 html

## 目标用户

KnowMe 桌面用户：重构后应仍能按 `f6ad048` 的路径完成货架启动、任务房间、管线、Studio、助理会话、设置与专家库，而不是一套简化壳。

## 验收标准

- 界面清单中「须还原」项均可在 React 中走通，且对照 `f6ad048` 截图：布局、图标、字号、间距、层级、关键动效一致。
- 基线有、现行 IPC 仍有的能力，React 已接线（非假文案 / 本地假会话）。
- `npm test`、`npm run lint`、`npm run typecheck:renderer`、`test:renderer` 通过。
- 制作人按 `acceptance.md` 对照 `f6ad048` 签字。

## 非目标（Non-goals）

- **禁止** checkout / 粘贴 `workbench.js`、`workspace.html` 作为交付。
- **禁止**恢复独立便签窗、list 总览、便签备份、托盘「关便签」。
- 不改 Daemon HTTP 协议、不改 `%APPDATA%\KnowMe\` 路径。
- 不引入 React Flow 等重型画布库（沿用现有 SVG/DOM 画布）。
- 不加 `f6ad048` 没有的新 IA / 新功能。
- 不把 git `main` 便签三页当作对照。
