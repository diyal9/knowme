# Dev self-test — redesign-workbench-task-cards-grid

日期：2026-08-12

## 硬项

- 相关单测：`workbench-templates` / `workbench-task-store` / `expert-task-chat-workbench` 通过
- `npm run lint`：通过

## 实现核对

- 「你的任务」三列卡片 + 执行摘要 + 收起预览 3 条
- 「安排专家执行任务」三列一排预览（3 卡）；超出显示「更多 / 收起」；展开后网格内滚动
- 去掉原先硬截断 `slice(0, 8)`，展开可操作全部快捷专家

## 结论

开发自测通过；已重启 Electron，请在任务 Tab 确认快捷专家折叠。
