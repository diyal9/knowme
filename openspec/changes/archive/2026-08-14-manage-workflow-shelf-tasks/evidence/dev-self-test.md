# Dev self-test: manage-workflow-shelf-tasks

## Commands

- `npm test` — pass
- `npm run lint` — pass

## Notes

- 「你的工作流任务」标题旁新增 `wbShelfTaskManage` 设置入口
- `openTaskManageHub('workflow')` 打开「管理工作流任务」，列表仅含 `workflowId` 任务
- 删除走既有 `workbenchTaskArchive`，并刷新货架空态
