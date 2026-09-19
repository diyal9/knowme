# Code Review

## 结论

本次范围无阻断代码问题。认知写入遵循“先观察、再提案、确认后提交、统一可撤销”的产品边界。

## 架构与数据

- `brain-cognition.ts` 只负责确定性候选提取和分类，不直接操作持久化。
- `brain-cognition-runtime.ts` 负责权限、敏感/一次性过滤及 Memory bridge。
- `BrainService` 统一 Proposal 去重、编辑确认、拒绝、稍后处理和 Growth Ledger。
- 稳定 fingerprint 防止重复提案；已确认或已拒绝的同义观察不会重新进入队列。
- 确认前编辑会同步修正实际 Effects，避免界面内容与落库内容不一致。

## 权限与隐私

- 观察器只接收当前用户输入，不上传完整对话、Memory 或 Brain。
- 一次性会话、敏感内容和禁用个人记忆的 Agent 不进入认知流程。
- Agent 回答失败或取消时不学习；观察异常被隔离，不影响正常回答。
- 所有 Agent 的稳定写入仍经 Proposal，`allowDirectWrite` 保持为 false。

## 产品语义

- 用户事实、目标、项目、决策和知识偏好归入 Brain。
- 回复风格、主动程度与协作策略归入 Partner Profile。
- 弱观察保留在 Memory，达到阈值后才参与治理。
- 确认历史统一进入 Growth Ledger，撤销会同步反向更新目标系统。
