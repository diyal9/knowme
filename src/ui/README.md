# UI 积木（跨窗）

跨窗口可复用的 UI 积木放这里：`renderX(opts)` / `mountX(el, opts)`，无业务 store。

当前共享内核仍以 `src/lib/ui-kit.js` 为准（escape / toast / relativeTime）。
新积木优先扩展 ui-kit，或在本目录新增并在 HTML 中于业务脚本之前加载。

**不要**把货架卡片、Daemon 步骤等单面专用 UI 放这里——那些进 `src/workbench/`。
