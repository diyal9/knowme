# QA Plan: isolate-assistant-session-tabs

## Smoke Scope（必填）

- [ ] 助理 Tab 仅有真正助理对话；切到工作台开专家任务后回助理，Tab 不增加
- [ ] 工作流货架进入对话房后回助理，不见该 Session
- [ ] 打开含「工作台 ·」标题的历史污染 Tab 后重启，助理栏已清除
- [ ] 能力面开始专家对话仍在助理新建 Tab
- [ ] 工作台最近任务可恢复同一专家 Session

## Regression Scope

- 助理多 Tab / Pin / 关闭 / 历史重开
- 工作台 task-room 左右栏与 Composer 预填
- Daemon 运行日志在工作台任务间仍可见

## Anti-pattern Checks（交给测试）

- 助理栏出现「工作台 · …」或任务名堆叠
- 切助理后仍显示 Daemon 过程卡片来自工作台 Session
- 能力面开工被误迁到工作台 surface
