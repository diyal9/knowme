## Why

`workbench.js` 已逾万行，纯 HTML/JS 渲染栈使每次功能与 UI 改动都消耗在拆文件与 DOM 同步上。开发期可封版：在独立分支将渲染层换为 React + TypeScript + Vite，产品行为与内容保持与当前基线一致，对比通过后再合回，以便长期聚焦业务交付。

## What Changes

- 新增 Vite + React 19 + TypeScript 渲染工程（`src/renderer/`），首期覆盖 workspace（助理壳 + 工作台）。
- 主进程支持 `KNOWME_RENDERER=legacy|vite` 双入口（默认 `legacy`），便于与主线并排对比。
- 从 `preload.js` 落地 `window.api` 类型（`api.d.ts`）；渲染层禁止直接使用 `ipcRenderer`。
- 按 surface 蚕食迁移工作台；领域逻辑继续复用 `src/lib/*`。
- 次要窗体（settings / list / memory / note 等）同策略后续合入，不阻塞首 PR。
- **非 BREAKING**：默认仍走 legacy；产品功能、IA、文案、视觉、数据路径与 Daemon/IPC 语义不变。

## Capabilities

### New Capabilities

- `renderer-react-ts`: 渲染层 React/TS 双入口、typed preload 桥与 workspace 对等迁移载体。

### Modified Capabilities

- （无：用户可见行为与现网一致；仅实现载体变更。）

## Impact

- 代码：`src/main.js`（workspace 加载开关）、`src/renderer/**`、`package.json` 脚本与 devDependencies、`scripts/prebuild.js`（打包前构建 renderer）
- 依赖：`typescript`、`vite`、`@vitejs/plugin-react`、`react`、`react-dom`
- 流程：分支 `refactor/renderer-react-ts` → parity 对比 → PR 合入
- 测试：现有 `npm test` / `lint` 保持；新增 `typecheck`；Playwright 冒烟对新入口

## 目标用户

维护 KnowMe 桌面端的开发者；验收侧为制作人（对比「与现版一致」）。

## 验收标准

- 分支可切 `legacy` / `vite`；默认 legacy 行为与基线一致。
- vite 入口下 workspace 主路径 parity 矩阵关键项通过。
- `npm test`、`npm run lint`、`npm run typecheck` 通过。
- 制作人确认产品内容/流程无故意变更后，PR 可合入（默认可回滚 legacy）。

## 非目标（Non-goals）

- 不重写主进程业务与 `src/ipc/*` 语义。
- 不改 Daemon API、不改 `%APPDATA%\KnowMe\` 布局。
- 不引入重型 UI 组件库；Studio 不强上 React Flow。
- 迁移期内不做视觉换肤、IA 调整或新功能。
