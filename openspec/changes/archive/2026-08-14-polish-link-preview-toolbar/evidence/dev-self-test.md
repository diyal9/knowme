# 开发自测报告

- 日期：2026-08-05
- Change：`polish-link-preview-toolbar`
- 定向测试：PASS（`node --test tests/feishu-document-link-actions.test.js`，14/14）
- `npm test`：PASS（975/975）
- `npm run lint`：PASS（lint ok，script-scope ok）
- OpenSpec：PASS（`openspec validate polish-link-preview-toolbar --strict`）
- IDE Lint：PASS（修改文件无诊断）
- 手动冒烟：PASS
  - KnowMe 已重启，主进程正常启动；未出现 uncaught error（仅 Electron 开发态既有 CSP warning）。
  - 用实际 `workspace.html` 静态承载链接预览状态核对：操作组计算样式为透明背景、`0px` 边框、`0px` 内边距。
  - 实际挂载图标顺序为 `maximize / externalLink / copy / circleX`，四个按钮均可见；视觉截图：`C:\Users\Administrator\polish-link-preview-toolbar.png`。
  - 静态承载的 `window.api` 报错来自浏览器环境缺少 Electron preload，不存在于已重启的 Electron 应用日志中。
- 备注：渲染层仅调整操作组装饰与三个 `data-icon`；按钮 ID、事件绑定、IPC 与链接安全逻辑未变。
