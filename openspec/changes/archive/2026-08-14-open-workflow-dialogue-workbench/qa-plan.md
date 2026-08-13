# QA Plan — open-workflow-dialogue-workbench

## Smoke Scope

- [ ] 工作流货架点「会议纪要与待办」卡片空白 → 双栏对话房（非详情、非填写本次信息）
- [ ] 页脚 play 进入同一对话房；编辑/复制不进对话房
- [ ] 左栏为起点专家对话，Composer 可有目标草稿且不自动发送
- [ ] 右栏可见工作流需要/产出、步骤与连接器/技能/知识
- [ ] 右栏「开始运行」可进入既有确认输入（可运行时）
- [ ] 返回最近任务可恢复同一 Session 与工作流右栏

## Regression Scope

- 单专家任务「创建并开始」仍进专家对话房
- 既有 daemon/local run 恢复路径
- 货架筛选、复制/编辑、不可运行 toast

## Automation

- `tests/workbench-templates.test.js`
- `tests/workbench-task-store.test.js`（若有 workflow 字段断言）
- lint + 相关单测
