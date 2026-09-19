# RQA119：历史用户活动兼容迁移

## 问题

活动契约升级前，历史任务中的 `input_provided`、`input_queued`、`plan_confirmed`、`changes_requested` 和 `deliverable_accepted` 可能没有来源、类型和操作者字段；部分旧验收事件还会被保存成 `source: system`。任务重新打开后，页面只能按默认来源渲染，用户动作容易看起来像专家或系统更新。

## 修复

任务存储层在归一化历史事件时，根据稳定的事件语义补齐：

- 用户输入类：`kind: message`、`source: user`、`actorId: user`。
- 验收类：`kind: review`、`source: user`、`actorId: user`。
- 已有明确的非用户来源且不属于上述历史兼容场景的事件保持不变。

新写入事件继续使用显式活动契约，不依赖这个兼容推断。

## 验证

- 聚焦后端：`52/52` 通过。
- 完整 `npm run check`：后端 `3463/3514` 通过、`51` 跳过、`0` 失败；Renderer `86` 文件、`624/624` 通过；lint 和类型检查通过。
- GitNexus 对 `normalizeEvents` 的上游影响评估为 `LOW`，直接调用链为 `normalizeTask`，未发现跨模块高风险流程。

## 边界

这修复了历史任务的对话语义恢复，不改变真实 Provider、工具授权或专业质量认证结论。当前 `productionReady=false` 仍由 7 条条件路线缺少真实执行回执导致。
