# QA Plan: refine-workbench-guidance-and-header

## Smoke Scope（必填）

- [ ] 进入工作台，确认头部以单一控件呈现“工作模式 + 当前模式”，总览/团队/工作流标签可正常切换。
- [ ] 切换到视觉创作并进入工作流，确认无工作流状态显示当前模式和两个可行动入口。
- [ ] 点击“安装专业能力”进入能力中心技能页，点击“添加 Agent”进入既有 Agent 选择路径。
- [ ] 在视觉创作模式查看最近运行，确认标题和卡片明确说明记录来自软件研发。
- [ ] 点击失败任务，确认打开既有任务详情。

## Regression Scope

- 软件研发模式下工作流搜索、常用/高级目录、工作流打开和启动行为。
- 模式切换后的总览数据和团队绑定。
- 刷新动作、最近运行展开/收起、任务工作间头部隐藏规则。
- 默认窗口与窄窗口下无横向遮挡。

## Anti-pattern Checks

- 空状态只解释问题但没有可执行按钮。
- “工作模式”在模式控件外重复出现，视觉上像第四个页面标签。
- 当前模式为视觉创作但研发历史没有来源说明。
- 失败条目只有红点和“执行失败”，用户无法预期点击结果。
- 原生下拉、按钮或标签缺少键盘焦点反馈。

## Automated Checks

- `node --test tests/workbench-templates.test.js`
- `npm test`
- `npm run lint`
- `openspec validate refine-workbench-guidance-and-header --strict`
