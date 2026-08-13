## 1. 模型与投影

- [x] 1.1 `TAB_IDS` 增加 `logs`；`recommendationLabel` / `projectReviewSurface` tabs 标签含「过程日志」
- [x] 1.2 `projectReviewSurface` 附带 `process`（`projectProcessTranscript` 结果）供 UI 渲染

## 2. 布局与壳层

- [x] 2.1 `workspace.html`：事件后增加过程日志 Tab；刷新移入 tabs 行右侧（仅图标）；移除 foot「过程日志」与旧刷新
- [x] 2.2 `workbench-layout.css`：tabs 行容纳右侧刷新；收敛/移除 foot 样式；logs Tab 正文样式

## 3. 运行时

- [x] 3.1 `renderDaemonReviewBody` 渲染 `logs` Tab（progress + 运行日志）
- [x] 3.2 `switchDaemonReviewTab` 支持 `logs`；切入时拉取 progress/logs
- [x] 3.3 `syncDaemonProcessFeed` 改为清空左栏过程卡；`focusDaemonProcessLogs` 改为切到 logs Tab
- [x] 3.4 刷新按钮显隐逻辑仍绑定 slug

## 4. 测试与自测

- [x] 4.1 更新 `workbench-daemon-review.test.js` / `workbench-templates.test.js`
- [x] 4.2 `npm test` && `npm run lint`
- [x] 4.3 写 `evidence/dev-self-test.md`
