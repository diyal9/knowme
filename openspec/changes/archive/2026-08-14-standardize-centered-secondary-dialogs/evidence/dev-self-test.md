# 开发自测报告

- 日期：2026-08-06
- Change：`standardize-centered-secondary-dialogs`
- OpenSpec strict validate：PASS
- `npm test`：PASS（1196 tests，0 fail）
- `npm run lint`：PASS（lint ok，script-scope ok）
- Electron 真机冒烟：PASS
- 手动/视觉检查：PASS

## 覆盖范围

- 能力 Hub 的「写作润色」详情在 iframe 当前视窗水平、垂直居中。
- 详情弹窗标题栏与底部安装操作保持固定，长内容仅在中间内容区滚动。
- 遮罩、关闭按钮与 Escape 关闭路径可用，关闭后焦点回到触发卡片。
- Workspace 的能力 Hub 一级页面保持从 rail 打开的整页覆盖模式，未被弹窗样式缩小或偏移。
- 版本对比与最终提示词预览使用 Workspace `mode-secondary-dialog` 居中模式；设置、知识库、能力 Hub 继续使用 `mode-center-surface`。
- 窄视窗有安全边距，`prefers-reduced-motion` 下关闭动效。

## 真机证据

- 报告：`evidence/secondary-dialog-electron-smoke.json`
- 截图：`evidence/screenshots/capability-detail-centered.png`

## ReACT 记录

- Observe：首次 Electron 冒烟发现共享居中 transform 影响了一级整页面板，能力 Hub 宿主被偏移到视窗外。
- Reflect：将 Workspace 的 `secondary-dialog` 类改为仅在临时二级弹窗打开时动态挂载，并在一级模式显式移除；复测一级页面几何与二级弹窗几何均通过。
- 控制台：无本次变更新增的 renderer error；开发态 Electron CSP 警告为既有提示。
