## ADDED Requirements

### Requirement: React is the only workspace renderer

应用 MUST 默认加载 Vite/React workspace 入口。MUST NOT 将 `workspace.html` 或 LegacyHost 作为默认交付。

#### Scenario: Default loads React workspace

- **WHEN** 未设置 `KNOWME_RENDERER` 或值为 `vite`
- **THEN** workspace 窗口 MUST 加载 React/TS 入口（Vite dev 或 `dist/renderer/workspace`）
- **AND** 预加载脚本仍为 `preload.js`（`contextIsolation` 保持）

#### Scenario: Renderer does not mount legacy workspace.html

- **WHEN** React workspace 启动完成
- **THEN** 页面 MUST NOT 通过脚本注入整份 `workspace.html` 作为 UI 宿主

### Requirement: Typed preload bridge for renderer

Vite 渲染层 MUST 仅通过类型化的 `window.api` 与主进程通信，MUST NOT 直接使用 `ipcRenderer`。

#### Scenario: Renderer uses typed api

- **WHEN** TypeScript 渲染代码调用主进程能力
- **THEN** 调用 MUST 经由 `window.api` 与 `src/shared/api.ts` 声明
- **AND** `npm run typecheck:renderer` MUST 通过

### Requirement: Workspace surfaces are React-owned

workspace MUST 以 React 提供 rail、助理、工作台 surface（shelf / taskhome / manage / run / studio），文案与流程不得故意变更。

#### Scenario: Rail navigates workbench and assistant

- **WHEN** 用户点击侧栏「工作台」或「助理」
- **THEN** 中心内容区 MUST 切换到对应表面
- **AND** 当前项 `aria-pressed` 为 true，另一项为 false

#### Scenario: Workbench surfaces remain reachable

- **WHEN** 用户在工作台进入 shelf、taskhome、manage、run 或 studio
- **THEN** 对应表面 MUST 可到达且可返回
