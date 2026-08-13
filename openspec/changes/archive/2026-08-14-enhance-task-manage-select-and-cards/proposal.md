## Why

「管理最近任务」弹窗目前只能全选/手勾，清理陈旧任务费力；卡片仅一行状态+专家名，缺头像与可展开进度，批量管理时难以辨认任务归属与进展。

## What Changes

- 底栏「全选」旁增加选择策略（至少含「超过 3 个月」；另提供「已完成」「超过 1 个月」「清空」等）
- 任务卡片展示专家信息（头像 + 名称），不再只靠纯文本串
- 任务进度改为可 toggle 展开/收起，默认收起，避免列表过长

## Capabilities

### New Capabilities

- `task-manage-hub`: 最近任务管理弹窗的选择策略与卡片信息密度（专家头像、进度 toggle）

### Modified Capabilities

- （无主规格增量以外的既有 capability 改名；行为增量落在新 capability）

## Impact

- `src/workbench.js`：`openTaskManageHub` / 选择策略 / 卡片渲染
- `src/workbench-layout.css`：策略按钮与卡片布局
- `tests/workbench-templates.test.js`：结构断言

## 目标用户

在工作台任务首页批量清理最近专家任务的用户。

## 验收标准

1. 「全选」旁可见多项选择策略；点「超过 3 个月」只勾选 `updatedAt` 早于约 90 天的任务
2. 每张卡片可见专家头像（无图则语义图标回退）与专家名
3. 进度区默认收起，点 toggle 可展开摘要/目标；再次点击收起
4. 删除所选仍仅作用于勾选项；未勾选时删除按钮禁用

## 非目标（Non-goals）

- 不改归档 API / 任务存储 schema
- 不在本弹窗内打开对话或改任务状态
- 不引入复杂筛选面板（搜索、多维筛选）
