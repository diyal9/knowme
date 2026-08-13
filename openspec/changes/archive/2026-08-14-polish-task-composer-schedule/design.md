## Context

任务 store 已支持 `schedule*` 字段与主进程分钟 tick；新建弹窗 `openTaskComposer` 目前把 `goal || pendingGoal` 写入目标框，易带入管线/会话残留文案。知识库列表用大卡片 + 弹窗拉伸导致留白。

## Goals / Non-Goals

**Goals**

- 知识库区更紧凑；目标预填可控；新建时可设可选定时。

**Non-Goals**

- 不改 due 触发管线；不新增云端调度。

## Decisions

1. **目标预填**：`openTaskComposer({ goal })` 只使用显式 `goal`；去掉对 `pendingGoal` 的回退。`pendingGoal` 仍在开始任务成功后更新。
2. **定时默认关**：开关关闭时不展示频率控件；开启后复用自动化同款 `daily|interval|once` 控件语义，写入 `scheduleEnabled` + `schedule`。
3. **创建并开始**：始终立即 `beginExpertTask`；若开启定时，在 create/update payload 带上 schedule 字段，父任务保留计划供 tick 生子任务。
4. **知识库排版**：缩小选项内边距、单列紧凑行；弹窗 body 按内容高度收缩，避免知识库与按钮之间大段空白。
5. **提示**：定时区块下方一行小字说明「仅本机 App 运行时触发」。

## Risks / Trade-offs

- 去掉 pendingGoal 回填后，从其它入口「带着目标开任务」需显式传 `goal`（当前仅任务卡复开会传，符合预期）。

## Migration Plan

无。旧任务字段不变。

## Open Questions

无。
