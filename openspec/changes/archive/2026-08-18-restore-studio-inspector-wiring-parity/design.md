## Context

基线：`f6ad048` `renderStudioInspector` / `studioSkillPicker` / `connect` / `workflowManageFlowSteps`。

## Decisions

1. 技能：读写 `node.profile.skillRefs[{id,version}]`；兼容旧 `config.skillIds` 只读迁移一次。
2. 条件：`config.compare` = `equal|not_equal|contains|blank`（不再用 `op`/`eq`）。
3. 连线：从 condition 的 branch-true/false 端口连出时写入 `branch` + 中文 label；拒绝成环仍由 model.connect 负责。
4. 串联：自由图画布连线成功后，若未设 relation，默认 `serial`；属性区可改 parallel/approval（步骤模式沿用 chip）。
5. 简要流程：`toShelfCard` 保留 raw labels；管理/货架渲染时用 hub 专家名解析 id。

## Electron 边界

仅渲染层 + domain；`workbench-studio-model` 已支持 profile，不改 IPC。

## Risks

| Risk | Mitigation |
|------|------------|
| 旧草稿只有 skillIds | 打开时合并进 skillRefs |
| 条件旧 op 值 | 读入时映射到 compare |
