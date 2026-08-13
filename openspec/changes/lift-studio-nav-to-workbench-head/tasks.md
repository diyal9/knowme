## 1. Structure

- [x] 1.1 在 `wb-head` 增加 Studio 导航区（标题 + meta）
- [x] 1.2 移除 `#wbStudioSurface` 内二级 `wb-studio-topbar`
- [x] 1.3 移除左侧文案「返回」按钮；编排返回改由右侧 `#wbReload`

## 2. Behavior & style

- [x] 2.1 `setSurface` / `syncModeTabs`：Studio 显示导航，其它面隐藏
- [x] 2.2 CSS：顶栏导航对齐 agentUniverse 式左导航；顶栏空白消除
- [x] 2.3 `renderStudio` 继续更新 top meta；`syncHeadActionButton` 在 Studio 显示右侧返回

## 3. Verify

- [x] 3.1 `npm test` / `npm run lint`（或 gate 硬项）
- [ ] 3.2 本地打开编排页确认单层顶栏与右侧返回
