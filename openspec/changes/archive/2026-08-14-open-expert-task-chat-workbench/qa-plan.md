# QA Plan

## Smoke Scope

- [x] 在工作台新建任务，选择专家、填写目标并选择一个知识库。
- [x] 点击“创建并开始”，确认直接进入双栏专家对话，不出现 Agent Graph 二次确认。
- [x] 确认左侧显示专家属性、专业能力、技能/连接器和知识库，Composer 保留目标草稿。
- [x] 在 Composer 工具栏修改知识库范围，确认当前 Session 更新且其他 Session/全局默认不变。
- [x] 返回任务列表并重新打开任务，确认恢复同一 Session、草稿和知识范围。
- [x] 模拟 Session 创建失败，确认弹窗输入保留、任务为草稿且不误报已开始。

## Regression Scope

- 普通助手对话与能力中心“开始使用”路径。
- 旧 `execRef.kind=run` 任务仍进入原 Run 恢复路径。
- 无显式知识选择时使用默认 Provider。
- 显式选择全部失效时安全降级，不扩大到其他 Provider。
- 窄窗口 task-room、键盘焦点、知识库选择菜单与返回任务。

## Automation

- `tests/expert-task-chat-workbench.test.js`
- `tests/session-knowledge-scope.test.js`
- `tests/agent-sessions.test.js`
- `tests/workbench-task-store.test.js`
- `evidence/expert-task-chat-electron-smoke.js`
