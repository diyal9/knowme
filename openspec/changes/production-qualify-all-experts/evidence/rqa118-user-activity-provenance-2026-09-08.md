# RQA118：通用用户活动来源契约

## 变更

- 用户在执行中的补充输入与排队输入统一写入 `kind: message`、`source: user`、`actorId: user`。
- 成果物验收通过和要求修改统一写入 `kind: review`、`source: user`；未显式传入操作者时默认使用 `user`。
- 保留历史事件的兼容归一化，不改变专家、工作流和系统事件的默认边界。

这使对话、时间线、验收和重开流程可以依据统一活动来源重放用户动作，不需要按某个专家或某个 Agent 的特性增加页面分支。

## 验证

- 后端聚焦回归：`52/52` 通过（专家运行时 + 任务存储）。
- 完整后端：`3463/3514` 通过、`51` 跳过、`0` 失败。
- Renderer：`86` 文件、`624/624` 通过。
- `npm run lint`：通过（仅保留既有文件长度 advisory）。
- `npm run typecheck:renderer`：通过。

## 边界

这项修复解决的是平台活动来源和对话可重放性，不等于真实 Provider 或专家专业质量已经完成认证。当前生图真实探针仍受系统安全存储不可用阻断，`executionReady=false / productionReady=false` 保持不变。
