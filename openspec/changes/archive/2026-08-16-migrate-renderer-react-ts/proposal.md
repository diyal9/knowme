## Why

`workbench.js` 已逾万行，纯 HTML/JS 使正式产品开发会持续偿还 DOM 同步债务。Demo 已成型：将渲染层全量升级为 React + TypeScript + Vite（架构升级，非逐行翻译），产品行为与现版一致，运行时不再加载页面级 html/js。

## What Changes

- 渲染层唯一载体：`src/renderer/**`（React 19 + TS + Vite）。
- Electron **默认**加载 Vite 产物；**禁止** LegacyHost / 挂载 `workspace.html` 作为交付。
- 完整 typed `window.api`（`src/shared/api.ts`）；UI 禁止 `ipcRenderer`。
- 按 feature 重写壳、工作台 surfaces、助理、次要窗；领域逻辑进 `src/domain/`。
- Spec 驱动：OpenSpec Scenario → 红测 → 实现 → 绿测。
- 产品功能、IA、文案、视觉 token、数据路径与 Daemon/IPC 语义不变。

## Capabilities

### New Capabilities

- `renderer-react-ts`: React/TS 为唯一渲染栈；typed preload；workspace 与次要窗对等重写。

### Modified Capabilities

- （无用户可见需求变更；实现载体替换。）

## Impact

- `src/main.js` 窗口加载、`src/renderer/**`、`src/domain/**`、`src/shared/api.ts`
- 依赖：React、Vite、Zustand、Vitest、Testing Library
- 门禁增加 `test:renderer` / `test:e2e`

## 目标用户

KnowMe 桌面用户（体验与 Demo 一致）；开发者（后续只写 React/TS）。

## 验收标准

- 默认入口为 Vite/React；不加载 `workspace.html`。
- parity-matrix 关键项为 React 实现（非 hosted）。
- `npm test`、`lint`、`typecheck:renderer`、`test:renderer`、`test:e2e` 通过。
- 制作人确认与现版 Demo 行为一致。

## 非目标（Non-goals）

- 不重写主进程业务与 `src/ipc/*` 语义。
- 不改 Daemon API、不改 `%APPDATA%\KnowMe\`。
- 不引入重型 UI 库 / React Flow。
- 不换皮、不改 IA、不加新功能。
- **禁止** LegacyHost 作为交付形态。
