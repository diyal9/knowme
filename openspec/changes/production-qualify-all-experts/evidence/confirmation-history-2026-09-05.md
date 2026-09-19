# 用户确认内容缺失：真实记录核对与回归

## 截图对应任务

- 任务：`task-mto99tkr-2c3kl`。
- 只读检查 `%APPDATA%/KnowMe/workbench-tasks.json`，未更改用户任务数据。
- `2026-09-05T10:47:09.261Z` 的 created 事件保存了“已确认委托单并开始预检”。
- brief.materials 只有 clarification-record 和 confirmed-plan，没有 user-plan-confirmation / user_confirmation。不能从执行成功反推用户当时的原始文字。

## 当前代码行为

ExpertTaskRoom.confirmPlan 在按钮/文字确认时加入用户消息，并将原文作为 user_confirmation 随任务保存。restoreDiscussionMessages 从任务材料恢复原文，并避免与已加载的会话消息重复。这是所有专家共用的房间逻辑，不依赖生图专家 ID。

旧任务缺失的确认原文不能通过渲染修复自动找回；本次未伪造确认文字、未重跑该用户任务，也未把系统启动事件冒充为用户发言。

## 本次新增验证

房间测试增加 running / needs_input / review / completed 四状态的关闭后重新挂载验证：清空内存消息，再从模拟持久化任务恢复，确认原文只出现一次。另验证历史启动事件缺少原文时，不伪造用户确认气泡。

执行命令：

```text
npx vitest run --config vitest.config.ts src/domain/expert-collab-plan.spec.ts src/renderer/features/expert/expert-task-room.spec.tsx
```

结果：2 文件、60 测试通过（domain 24，room 36），退出码 0。

边界：这证明确认识别和房间保存请求/恢复渲染的回归；房间 IPC 使用 mockApi，不是本次真实 Electron 新建任务全链路验收，也不代表全部专家生产验收完成。
