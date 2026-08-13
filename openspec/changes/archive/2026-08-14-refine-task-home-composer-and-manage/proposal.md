## Why

「最近任务」旁的「定时任务」入口与弹窗占用注意力，但用户当前更需要清理最近任务；新建任务弹窗布局杂乱（取消/主按钮位置、专家纯文本下拉、知识库复选框被样式撑破），影响开任务转化。

## What Changes

- **移除**「定时任务」入口文案与定时管理弹窗入口（最近任务区不再打开定时 Hub）
- **替换**原按钮为设置图标：打开「管理最近任务」，支持勾选并批量删除（归档）
- **优化**「安排专家执行任务」弹窗：去掉取消、右上角关闭、主按钮右对齐；专家选择改为简要带头像卡片下拉；修复任务知识库复选布局
- 不改后端定时调度内核（已设定时的任务仍可由本机 tick 触发）；本 Story 仅去掉产品面入口

## 目标用户

在工作台用专家开任务、需要整理最近任务列表的桌面用户。

## 验收标准

- 最近任务区无「定时任务」文案/时钟入口；改为设置图标且可批量删除
- 新建任务弹窗：无取消、有右上关闭、「创建并开始」在合适位置；专家下拉为带头像简卡；知识库选项整齐可读
- `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不删除 `workbench-task-scheduler` 后端与已有 schedule 字段
- 不在本 Story 重做工作流货架定时
- 不改「快捷专家 → 详情」交互语义

## Capabilities

### New Capabilities

- `task-home-composer-manage`: 任务首页新建弹窗体验与最近任务批量管理

### Modified Capabilities

- （无主规格 delta；行为落在新 capability）

## Impact

- `src/workspace.html`、`src/workbench.js`、`src/workbench-layout.css`、`src/workbench-console.css`
- 测试：`tests/workbench-templates.test.js`、`tests/expert-task-chat-workbench.test.js`
- API：复用已有 `workbenchTaskArchive`
