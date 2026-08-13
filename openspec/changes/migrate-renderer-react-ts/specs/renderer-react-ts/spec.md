## ADDED Requirements

### Requirement: Dual renderer entry for workspace

应用 MUST 支持通过环境变量 `KNOWME_RENDERER` 在 workspace 窗口选择渲染入口：`legacy`（默认，加载 `workspace.html`）或 `vite`（加载 Vite 开发服务器或 `dist/renderer/workspace` 构建产物）。

#### Scenario: Default loads legacy workspace

- **WHEN** 未设置 `KNOWME_RENDERER` 或值为 `legacy`
- **THEN** workspace 窗口 MUST 加载现有 `workspace.html`
- **AND** 产品行为与迁移前基线一致

#### Scenario: Vite entry loads React workspace

- **WHEN** `KNOWME_RENDERER=vite` 且 Vite 开发服务器可用或 dist 已构建
- **THEN** workspace 窗口 MUST 加载 React/TS workspace 入口
- **AND** 预加载脚本仍为同一 `preload.js`（`contextIsolation` 保持）

### Requirement: Typed preload bridge for renderer

Vite 渲染层 MUST 仅通过类型化的 `window.api` 与主进程通信，MUST NOT 在 renderer 源码中直接使用 `ipcRenderer`。

#### Scenario: Renderer uses typed api

- **WHEN** TypeScript 渲染代码调用主进程能力
- **THEN** 调用 MUST 经由 `window.api` 与 `api.d.ts` 声明的方法
- **AND** `npm run typecheck` MUST 通过

### Requirement: Workspace product parity on vite entry

在 `KNOWME_RENDERER=vite` 下，workspace MUST 提供与 legacy 对等的用户可见能力（侧栏 rail、助理、工作台 surface：taskhome / shelf / manage / run / studio），文案与流程不得故意变更。

#### Scenario: Rail navigates workbench and assistant

- **WHEN** 用户在 vite workspace 点击侧栏工作台或助理入口
- **THEN** 中心内容区 MUST 切换到对应表面
- **AND** 行为与 legacy 入口语义一致

#### Scenario: Workbench surfaces remain reachable

- **WHEN** 用户在 vite 工作台进入 shelf、taskhome、manage、run 或 studio
- **THEN** 对应表面 MUST 可到达且可返回
- **AND** 关键 IPC（如 `workbenchLoad`、daemon 相关）仍经 `window.api` 工作
