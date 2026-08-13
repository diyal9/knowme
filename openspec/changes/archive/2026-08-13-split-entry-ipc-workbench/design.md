# Design: split-entry-ipc-workbench

## Layering

```
入口编排: main.js / workbench.js / workspace-*.js
IPC 注册: src/ipc/*.js          (Node require)
域 UI 控制器: src/workbench/*.js (浏览器 <script>，IIFE 挂 window)
领域逻辑: src/lib/**            (不变)
跨窗 UI: src/ui/                (积木；可委托 lib/ui-kit)
跨域工具: src/lib/utils/        (极瘦；无业务)
```

## IPC pattern

```js
// src/ipc/sources.js
function registerSourcesIpc(ipcMain, deps) { ... }

// main.js
const { registerCoreIpc } = require('./ipc')
registerCoreIpc(ipcMain, { loadSettings, saveSettings_, ... })
```

`deps` 注入避免循环依赖；main 仍是 composition root。

## Workbench browser modules

无 bundler：用 IIFE 挂 `window.WorkbenchX`，在 `workspace.html` 于 `workbench.js` 之前加载。
顶层禁止 `const`/`let` 撞名（script-scope lint）。

## Naming bans

禁止再建顶层 `logic/`、`core/`、`common/`、`shared/`。
