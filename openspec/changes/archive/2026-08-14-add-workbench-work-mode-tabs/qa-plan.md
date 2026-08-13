# QA Plan

## Smoke Scope

- [ ] 进入工作台，顶栏左侧出现「团队管线 / 我的 Agent」两个 Tab，默认选中团队管线
- [ ] Tab 长在顶栏内部（与能力页 / 知识网一致），下划线压在顶栏底边，内容区没有第二排 Tab
- [ ] 启动运行进入接管态后，顶栏的工作模式 Tab 隐藏
- [ ] 货架不再有「今日待办」区块，也不再有「官方 / 团队 / 我的」来源 chip
- [ ] 顶栏的搜索、管理、进行中、刷新在两个 Tab 下位置一致、始终可用
- [ ] 团队管线 Tab 只显示官方与团队来源工作流，领域筛选可见且默认「全部」
- [ ] 切到我的 Agent Tab，领域筛选整排隐藏；切回团队管线恢复且保留选择
- [ ] 我的 Agent Tab 显示本地 Agent 卡片（开始使用 / 调优）与个人工作流卡片
- [ ] 我的 Agent Tab 无个人工作流时，空态出现「从团队管线复制一份」「新建编排」可点击入口
- [ ] Daemon 在线/离线切换，团队管线的条目不会移动到我的 Agent Tab
- [ ] Agent 卡片「调优」进入该 Agent 的编辑面板；「开始使用」开启助理对话
- [ ] 悬浮助理菜单不再有「加入今日待办」，无点击无反应的死入口

## Regression Scope

- [ ] 工作流启动、运行三段式（确认输入 → 执行中 → 产物）、返回与恢复不回归
- [ ] 个人工作流的复制并调整 / 编辑不回归
- [ ] 重启后有旧 `shelfSource` 存档时货架正常渲染，不报错、不空白
- [ ] 管理抽屉四面板、进行中入口、窄窗（760px）布局不破版

## Anti-pattern Review（测试角色重点）

- [ ] 两个 Tab 是否又变成同一件事的重复入口
- [ ] 我的 Agent 空态是否伪装有内容
- [ ] 切 Tab 后是否有控件重复渲染或残留
- [ ] Agent 卡片主操作是否产生第二个对话场所与助理冲突

## Automated Checks

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npx openspec validate add-workbench-work-mode-tabs --strict`
- [ ] `node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-electron-smoke.js`
