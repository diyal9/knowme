# QA Plan: polish-workbench-team-empty-state

## Smoke Scope（必填）

- [ ] 进入工作台团队页，切换到没有成员的视觉创作模式。
- [ ] 确认空状态同时显示组队说明、“添加 Agent”和“浏览能力中心”。
- [ ] 点击两个动作，确认分别进入既有 Agent 选择路径和能力中心技能页。
- [ ] 展开“高级”，确认“工作方式”和模式选择器完整可见；切换模式后菜单可正常关闭。
- [ ] 在默认窗口和窄窗口检查无横向溢出、遮挡和控制台错误。

## Regression Scope

- 已有成员卡片分组、移除 Agent、模式切换和工作台 Tab。
- 首页添加 Agent、能力中心打开路径。
- 工作流目录、任务页和刷新行为。

## Anti-pattern Checks

- 空状态只解释原因，没有继续动作。
- 高级菜单贴在窗口边缘导致标题或选择器被裁切。
- 空状态按钮看起来像装饰，缺少 hover、active 或 focus 反馈。
- 新增 UI 暴露内部 IPC、Daemon 或权限实现细节。

## Automated Checks

- `node --test tests/workbench-templates.test.js`
- `npm test`
- `npm run lint`
- `openspec validate polish-workbench-team-empty-state --strict`
