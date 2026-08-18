## Why

React 渲染层迁移后，设置「我的记忆」与工作台「知识库」只保留了壳：个人资料、习惯审阅、近期记忆列表，以及知识条目打开/体检/AI 整理入口都缺失。用户要求与重构前（`f6ad048`）行为一致。

## What Changes

- 设置「我的记忆」恢复重构前分区：理解我（行业/关于我/协作偏好）、学习开关与统计、待确认推测、工作记忆整合、近期记忆与隐私操作。
- 「关于我」从「助手模式」挪回「我的记忆」，助手 Tab 只保留模式提示词。
- 知识库恢复条目/检索命中打开正文、健康检查、开始 AI 整理；空态引导指向设置「内容源」。
- 补齐 `window.api` 类型：`memoryOverview` / `memoryReviewPattern` / `knowledgeOsRead` / `knowledgeOsLint` / `knowledgeStewardTaskCreate`。

## Capabilities

### New Capabilities

- `settings-memory-parity`: 设置记忆 Tab 与重构前一致。
- `knowledge-os-parity`: 知识库浏览与整理入口与重构前一致。

### Modified Capabilities

- （无）

## Impact

- `src/renderer/features/settings/**`
- `src/renderer/features/knowledge/**`
- `src/renderer/app/store-files-knowledge.ts`、`store-types.ts`、`store.ts`
- `src/shared/api.ts`、`src/shared/api-extended.ts`

## 非目标

- 不恢复便签 `focusNote`
- 不恢复设置飞书 embedded iframe
- 不把知识库做成独立便签窗
- 不重做完整织网/治理画布（本轮只对齐浏览、预览、lint、整理入口）
