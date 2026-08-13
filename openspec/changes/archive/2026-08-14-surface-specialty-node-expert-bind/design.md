## Context

`validateDraft` 对 `COMPILE_AS_AGENT`（`agent|llm|tool|knowledge`）要求 `agentPackageId`，因为 specialty 节点编译为 runtime agent。右侧 Inspector 已有「执行专家」，但 agentUniverse 式卡片把主编辑挪到画布内联控件后，卡片未暴露该必填项。

## Decision

1. 在 `fieldsFromNode` 为 `llm|tool|knowledge` 增加 `bind: agentPackageId`、`type: select-expert`，放在类型专属配置之前。
2. `studioCanvasFieldControlHtml` 渲染 `select-expert`，复用 `studioExpertOptionsHtml`。
3. 调色板 `addNode` specialty 时，若候选本地专家非空且未显式传入 `agentPackageId`，预填第一位。

## Non-goals

- 不取消「必须绑本地专家」的运行时约束
- 不改 condition/join/gate 节点
