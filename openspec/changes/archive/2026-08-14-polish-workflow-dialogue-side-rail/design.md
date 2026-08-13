## Context

工作流对话房复用专家 task-room：顶栏状态经 `elExpertTaskStatus` → `syncDialogueStatusBar` 投影；右栏由 `renderExpertTaskRoom` 拼 `wb-side-workflow`。当前简单 IO 走 chips，状态恒为「协作中」，并保留 `data-workflow-room-action="run"` 次要跑批。

## Goals / Non-Goals

**Goals**

- 工作流对话状态文案改为「对话中」。
- 右栏：简介 / 需要 / 产出 / 协作步骤分段清晰；需要与产出固定清单。
- 去掉右栏「开始运行」与依赖该按钮的提示文案。

**Non-Goals**

- 不改货架卡片进对话房路径。
- 不改 `beginWorkflowRun` 实现本身（仅去掉对话房入口）。

## Decisions

1. **状态**：`openExpertTaskRoom` 有 `resolvedWorkflow` 时写「对话中」，否则「协作中」。
2. **清单**：侧栏调用 `renderWorkflowIoListHtml(..., { forceList: true })`，始终输出 `ul.wb-flow-io-list`。
3. **分段**：侧栏区块加 `wb-side-divider` / section border，步骤也可清单化。
4. **按钮**：删除侧栏 run 按钮与 click 分支可保留无害；提示改为「现在可以在左侧对话推进。」。

## Risks / Trade-offs

- 失去对话房内一键进确认输入；可接受，因主路径已是对话。后续若需跑批可另开货架/管理入口。

## Migration Plan

无数据迁移。
