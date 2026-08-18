# QA Plan

## Smoke Scope

- 进入工作台默认停在「任务」首页，顶栏三 Tab：任务 / 工作流 / Daemon。
- 三 Tab 互切正常，高亮与搜索框显隐正确（搜索仅在工作流 Tab 出现）。
- 任务首页：有专家时显示快捷卡片；点卡片 / 「新建任务」打开 composer；选专家 + 填目标 → 创建并进入运行；最近任务列表出现该任务，重启后仍在。
- 无专家时任务首页给出去能力界面创建专家的提示。
- 工作流 Tab：货架正常；「管理我的工作流」进入管理子页，可新建 / 删除，可「返回」回货架。
- Daemon Tab：进入执行后端面，显示连接状态与只读专家阵容；离线时不报错。
- 用户可见文案不出现「智能体」；studio 显示「可用专家 / 选择专家」。

## 反模式检查

- 快速在三 Tab 间来回点击，不残留上一个 surface 内容 / 不叠加弹层。
- composer 未选专家或空目标时给出错误提示，不创建空任务。
- 窄窗（760px）下任务卡片网格与最近任务行不破版。
- 旧存档（无 workbench-tasks.json）首次进入不报错，最近任务显示空态。

## 门禁

- `npm run lint` → 通过
- `npm test` → 1585/1585 通过
- `npm start` 手动自测 → 控制台无 error（记录到 evidence/dev-self-test.md）

## 证据

- `evidence/dev-self-test.md`
- `evidence/screenshots/`（任务首页 / 工作流 / Daemon）
