## 1. 顶栏两 Tab

- [x] 1.1 `workspace.html` 顶栏标题右侧新增 `#wbModeTabs`（工作流 / 管理），复用既有 `.wb-mode-tabs` 样式
- [x] 1.2 移除 `#wbManageToggle` 与 `#wbManageMenu`
- [x] 1.3 `workbench.js` 新增 Tab 路由：工作流 → 货架 surface；管理 → 管理 surface
- [x] 1.4 搜索框仅在「工作流」Tab 显示，搜索词切 Tab 不丢
- [x] 1.5 运行页 / 编排页隐藏两 Tab

## 2. 管理由抽屉升格为常驻 surface

- [x] 2.1 `#wbManageDrawer` 改为 `#wbManageSurface`（`.wb-surface`），移除关闭按钮
- [x] 2.2 `setSurface` 支持 `manage`；`closeManageDrawer` 语义改为切回货架
- [x] 2.3 `MANAGE_PANELS` 新增 `workflows` 并置于首位、作为默认分区
- [x] 2.4 `setWorkbenchPage('daemon'|'automation')` 外部跳转仍直达对应分区
- [x] 2.5 旧存档遗留的管理面板值安全回落到默认分区

## 3. 管理 Tab 的工作流分区

- [x] 3.1 新增 `#wbWorkflowManagePage`：新建工作流入口 + 我的工作流列表
- [x] 3.2 列表逐条「编辑」进入编排（`openOrchestration({ workflowId })`）
- [x] 3.3 列表逐条「删除」走 `workbenchWorkflowPackageArchive`，删除后货架同步移除
- [x] 3.4 空态提供「新建工作流」与「去货架复制团队流程」
- [x] 3.5 移除货架筛选行的 `#wbShelfNewWorkflow`（空态按钮保留）

## 4. 样式

- [x] 4.1 管理面由 fixed 抽屉改为 surface 布局，Daemon / 自动化面板不塌陷
- [x] 4.2 工作流管理列表样式
- [x] 4.3 窄窗(760px)与 900px 断点适配，删除失效选择器

## 5. 验证与证据

- [x] 5.1 更新 `tests/workbench-templates.test.js` 断言
- [x] 5.2 `npm test` 全绿
- [x] 5.3 `npm run lint` 无 error
- [x] 5.4 `npx openspec validate split-workbench-into-workflow-and-manage-tabs --strict` 通过
- [x] 5.5 Electron 实机自测：零控制台报错，截图两 Tab、管理三分区、工作流分区
- [x] 5.6 写 `evidence/dev-self-test.md`
