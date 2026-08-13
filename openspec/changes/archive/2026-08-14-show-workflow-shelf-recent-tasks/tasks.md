## 1. DOM / 样式

- [x] 1.1 在 `#wbShelfSurface` 货架网格下方增加「工作流任务」面板（列表、更多、空态）
- [x] 1.2 补充货架页纵向间距，复用最近任务卡片网格样式

## 2. 渲染与分流

- [x] 2.1 `renderTaskHome` / `paintTaskRecentList` 仅展示无 `workflowId` 的任务
- [x] 2.2 `renderShelf` 拉取任务并渲染工作流任务区（含折叠预览与空态）
- [x] 2.3 点击打开复用 `openTaskFromRecent`；「更多/收起」可切换

## 3. 验收工件

- [x] 3.1 补充 qa-plan / acceptance；开发自测记录
- [x] 3.2 `npm test` 与 `npm run lint` 通过

## 4. 货架一行折叠（跟进）

- [x] 4.1 货架网格默认只显示一行，提供「更多/收起」
- [x] 4.2 默认折叠时工作流首页不依赖页面滚动；展开后可滚动
- [x] 4.3 更新测试断言；`npm test` / `npm run lint` 通过
