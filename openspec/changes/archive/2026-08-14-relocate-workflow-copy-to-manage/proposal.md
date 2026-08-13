## Why

工作流首页卡片同时露出「运行」与「复制」会把发现/启动与维护动作混在一起；复制属于「维护我的流程」场景，应落在管理面编辑旁，首页只保留运行。

## What Changes

- 工作流货架卡片 footer **移除**「复制并调整」与「编辑」次按钮，仅保留「开始运行」图标按钮
- 工作流维护管理卡在「编辑」旁 **新增**「复制」图标按钮，复用现有 fork 能力生成一份「我的」流程
- 同步更新管理面提示/空态文案，避免再引导「去工作流首页复制」
- 更新相关模板断言测试

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`: 货架卡操作收敛为仅运行；管理卡增加复制入口

## Impact

- 代码：`src/workbench.js`（`shelfCardHtml` / `workflowManageItemHtml` / `handleWorkflowManageAction`）
- 文案：`src/workspace.html` 管理面 hint；空态 CTA
- 测试：`tests/workbench-templates.test.js`

## 目标用户

在工作台运行官方/共享流程，并在「维护你自己的流程」中管理个人副本的用户。

## 验收标准

1. 工作流首页每张可运行卡 footer 仅见运行（play）图标，不见复制图标
2. 维护管理页每张个人卡右上角为：复制 → 编辑 → 删除（复制紧挨编辑）
3. 点击管理卡复制后生成新的「我的」流程并可继续编辑
4. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改变 fork IPC / 包存储协议
- 不在本 change 为官方流程另开新的「从货架派生」入口（后续若需可单独提案）
- 不改 Studio 画布内节点复制
