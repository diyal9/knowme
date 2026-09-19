# RQA115：通用专家任务确认内容持久化

日期：2026-09-08

## 问题

专家计划确认通过 `brief.materials` 传入运行时，但任务活动流只记录“已确认委托并开始预检”。因此首次进入时可能看到确认反馈，刷新或重新打开任务后却只看到专家状态，用户实际选择没有作为对话内容保留。

## 修复

- 通用专家运行时识别 `user-plan-confirmation` 材料，并写入持久化 `plan_confirmed` 用户事件。
- 专家协作叙事把 `plan_confirmed` 与普通用户补充、修改意见统一渲染为用户对话回合。
- 任务时间线统一显示为“用户确认”，不再依赖某个专家或某种交互控件。

## 验证

- 运行时回归：`tests/expert-task-plan-confirmation-event.test.js` 通过，确认事件包含 `source=user`、用户原文，并持久化在任务事件流中。
- 叙事回归：`src/domain/expert-collab-narrative.spec.ts` 通过，重开后确认事件仍作为用户回合展示。
- 后端全量：3514 项，3463 通过、51 跳过、0 失败。
- Renderer 全量：86 个文件、623 项通过。
- `npm run lint`：通过；既有文件行数仅为 advisory warning。
- `npm run typecheck:renderer`：通过。

## 边界

该修复只解决确认内容的通用持久化和展示，不代表六个保留专家的真实 Provider、独立专业质量评审或生图视觉质量已经生产验收；当前总目标继续保持 ACTIVE。
