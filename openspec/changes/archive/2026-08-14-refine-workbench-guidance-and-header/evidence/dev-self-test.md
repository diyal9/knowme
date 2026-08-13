# 开发自测报告

- 日期：2026-08-07
- Change：`refine-workbench-guidance-and-header`
- 定向测试：PASS，`tests/workbench-templates.test.js` 33/33
- `npm test`：PASS，1422/1422
- `npm run lint`：PASS，`lint ok`、`script-scope ok`
- OpenSpec：PASS，strict validation
- Electron 冒烟：PASS，7/7
- 运行时错误：0

## 覆盖结果

- 头部模式控件高度 34px，“工作模式 + 视觉创作”整合显示。
- 工作流空状态高度 96px，包含“安装专业能力”和“添加 Agent”两个真实入口。
- 两个入口分别打开能力中心 `skills` 与 `experts` 页面。
- 非研发模式显示“跨模式历史 · 来自软件研发”。
- 失败任务统一显示“查看详情”并沿用既有任务打开路径。
- 1360×860 与 780×720 视口均无头部或空状态横向溢出。

## 证据

- 报告：`evidence/workbench-guidance-electron-smoke.json`
- 桌面截图：`evidence/screenshots/workbench-guidance-desktop.png`
- 窄窗口截图：`evidence/screenshots/workbench-guidance-narrow.png`
