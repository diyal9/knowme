## 1. Markup & styles

- [x] 1.1 在 `workspace.html` 最近任务列表下增加 `#wbTaskRecentToggle`（默认 hidden）
- [x] 1.2 在 `workbench-layout.css` 为展开态列表增加 max-height + overflow-y，并复用/对齐 list-toggle 样式

## 2. Render & interaction

- [x] 2.1 `workbench.js`：预览条数常量、`taskRecentExpanded` 状态、按折叠态渲染列表
- [x] 2.2 绑定「更多 / 收起」点击，切换展开态并重绘；同步 aria 与剩余数量文案
- [x] 2.3 空态与 ≤ 预览条数时隐藏切换按钮

## 3. Verify

- [x] 3.1 `npm test` 与 `npm run lint` 通过
- [x] 3.2 写入 `evidence/dev-self-test.md`
