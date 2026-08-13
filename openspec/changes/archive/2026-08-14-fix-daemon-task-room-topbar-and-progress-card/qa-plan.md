# QA Plan — fix-daemon-task-room-topbar-and-progress-card

## Smoke Scope

1. 打开进行中/已完成的 Daemon 任务房
2. 通栏顶栏：仅目的标题 + 态 + 返回；无工作流副文案并排
3. 右栏：Tab 上方可见工作流短名
4. 左栏：管线进度为单层卡，无双卡叠盖

## Anti-patterns

- 顶栏再次出现两段「Daemon 阶段 ·」
- 右栏身份行过高像第二顶栏
- 进度卡 kicker 与卡身视觉分离成两张卡
