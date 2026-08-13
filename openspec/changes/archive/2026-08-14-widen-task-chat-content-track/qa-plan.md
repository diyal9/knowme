# QA Plan — widen-task-chat-content-track

## Smoke Scope

- 工作台 → 工作流/专家任务对话：宽窗口下消息与输入框铺满左栏，两侧无大块居中留白。
- 助理首页（无文档）：内容仍居中，行长可读。
- 切换回任务对话：布局不抖动、不溢出。

## Anti-patterns

- 左栏仍像「窄报纸栏」悬在中间。
- Composer 与消息轨不对齐。
- 助理全宽页被一并拉成超长行。
