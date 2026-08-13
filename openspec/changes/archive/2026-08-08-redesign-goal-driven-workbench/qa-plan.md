# QA Plan: redesign-goal-driven-workbench

## Smoke Scope（必填）

- [ ] 打开工作台，确认头部只显示“开始 / 任务 / 团队”，首页显示目标输入和常用起点。
- [ ] 输入一个目标并点击开始，确认进入既有工作流启动预览或清晰的模板选择降级。
- [ ] 点击四个常用起点，确认目标可编辑且可以继续启动。
- [ ] 进入任务页，确认进行中、失败和跨模式历史均可见，失败任务显示详情入口。
- [ ] 进入团队页和全部模板，确认高级能力仍可访问。

## Regression Scope

- 模式状态和 Agent 绑定在重启后继续保持。
- 工作流搜索、常用/高级目录、启动弹窗、DAG 和 Daemon 请求不变。
- 任务工作间、刷新、展开/收起和能力中心入口不变。
- 默认与窄窗口头部和首页无横向溢出。

## Anti-pattern Checks

- 首屏要求用户选择模式。
- 首页只展示能力/工作流配置而没有目标入口。
- 点击常用起点后出现空白或伪造“已开始”。
- 失败任务只有状态颜色，没有查看详情入口。
- 隐藏模式后连团队、模板和任务历史也无法访问。

## Automated Checks

- `node --test tests/workbench-templates.test.js`
- `npm test`
- `npm run lint`
- `openspec validate redesign-goal-driven-workbench --strict`
