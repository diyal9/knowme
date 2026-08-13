# QA Plan: isolate-assistant-workflow-daemon-surfaces

## Smoke Scope（必填）

- [ ] 工作台进入 Daemon 运行间（有过程日志）→ 点左侧「助理」→ 无「Agent 全局运行过程」、仅助理空态/对话
- [ ] 工作流货架打开工作流对话房 → 点「助理」→ 无该工作流 Tab、无过程卡
- [ ] 助理「开始使用」四卡可见，且下方无 progress/运行日志块叠层
- [ ] 再回同一 Daemon 运行间 → 过程投影可恢复；助理仍干净

## Regression Scope

- [ ] 能力面/专家库在助理路径「开始对话」仍在助理新建 Tab
- [ ] 工作台专家任务对话房 Tab 仍在 workbench surface
- [ ] 助理多 Tab / Pin / 历史行为不变
- [ ] `isolate-assistant-session-tabs` 既有「工作台 ·」迁移仍有效

## Anti-pattern Checks（交给测试）

- [ ] 快速连点：工作台 ↔ 助理 ↔ 工作台，过程卡不闪回助理
- [ ] 助理空 Session + 残留 localStorage surfaceUi，启动后无脏工作台 Tab
- [ ] 标题「工作台 - xxx」历史 Session 不出现在助理栏
