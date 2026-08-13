## Smoke Scope

- [x] 1. 能力界面 → 技能页 → 打开一项已安装技能 → 任务列表可见 → 点「试用」→ 对话区出现新会话且输入框已预填、未发送。（自动：`hub-skill-tasks`；试用发起需人工确认对话已带上提示词）
- [x] 2. 能力界面 → 技能页 → 打开一项未声明任务的技能 → 任务区显示说明文案，安装/卸载按钮正常。（自动：`hub-skill-tasks`）
- [x] 3. 能力界面 → 专家页 → 打开一位已安装专家 → 看到装配的技能与连接器 → 点其中一项技能 → 跳到技能详情。（自动：`hub-expert-composition`；跳转需人工确认）
- [ ] 4. 能力界面 → 技能详情 → 看到装配了它的专家 → 点击可跳回专家详情。
- [ ] 5. 能力界面 → 安装一项高风险能力 → 应用内确认对话框列出风险依据 → Escape 取消 → 能力仍未安装、焦点回到触发按钮。
- [ ] 6. 能力界面 → 旧版技能 →「迁移为标准技能」→ 应用内输入对话框 → 取消不产生输出。
- [x] 7. 工作台 → 管理 → 新建工作流 → 加入一位 Agent → 在检查器勾选技能 → 步骤卡片技能计数更新 → 保存 → 重新打开该工作流 → 勾选保持。（自动：`studio-skill-picker` / `studio-skill-written`；保存后重开需人工确认）
- [x] 8. 工作台 → 编排 → 改动草稿 → 点「返回货架」→ 三选一确认 →「取消」留在原地且草稿不变 →「放弃修改」直接离开。（自动：`studio-dirty-guard` / `studio-dirty-discard`）
- [x] 9. 工作台 → 编排 → 把窗口宽度从 1200px 拖到 1000px → 检查器全程可见，只在侧栏与下方之间切换。（自动：`studio-narrow-inspector`）
- [x] 10. 工作台 → 编排 → 键盘聚焦某个步骤 → `Alt+↑` / `Alt+↓` → 顺序改变且焦点仍在该步骤。（自动：`studio-keyboard-reorder`）
- [ ] 11. 工作台 → 编排 → 技能列表搜索框过滤 → 已勾选的技能不会被过滤掉。

## Anti-pattern Checks

- 试用技能后输入框是否被自动发送（不应自动发送）。
- 取消确认对话框后是否残留 loading / disabled 状态。
- 装配关系跳转后能否用 Escape 正常逐层退回。
- 草稿拦截是否在没有修改时也弹出（不应弹出）。
- 键盘排序是否与拖拽排序产生不一致的结果。
- 窄窗下检查器折到下方时是否遮挡步骤画布或产生横向滚动。

## Regression Scope

- 专家「安装并开始 / 开始对话 / 添加到工作台」链路不变。
- 能力安装、启用、停用、卸载、更新结果不变。
- 工作流保存后的 package 结构（graph、agentRefs、skillRefs）向后兼容。
- 运行三段式与 Run 树证据展示不受影响。

## Evidence

- 自测：`openspec/changes/polish-capability-and-workflow-authoring/evidence/dev-self-test.md`
- 桌面冒烟脚本与报告：`evidence/ux-polish-desktop-smoke.js` / `evidence/ux-polish-desktop-smoke.json`
- 测试报告：`openspec/changes/polish-capability-and-workflow-authoring/evidence/test-report.md`
- 截图：`openspec/changes/polish-capability-and-workflow-authoring/evidence/screenshots/`
