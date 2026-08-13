## Context

当前 `testStudioWorkflow` = `saveStudioWorkflow` + 打开 `agent-graph` 启动确认；`save` 则直接落盘。弹层 `renderAgentGraphLaunchBody` 单列节点、目标只读且易被 `pendingGoal` 污染，「保存为我的工作流」插在 body 而非页脚。

## Goals / Non-Goals

**Goals**
- 保存与检查职责分离
- 保存确认弹层整洁可用
- Graph 检查可复用、可动画演示

**Non-Goals**
- 不改 Daemon / Team Run API
- 不做真实节点执行仿真

## Decisions

1. **新 modal.kind=`studio-save`**：从 `studioDraft` 渲染确认内容；确认调用既有 `saveStudioWorkflow`。
2. **工具栏 run → `previewCheckStudioGraph`**：调用 `inspectStudioGraph`，按 walk 顺序播动画；失败停在问题节点。
3. **检查标准落在 `workbench-studio-model.inspectStudioGraph`**：结构 + 绑定；返回 `{ ok, issues, walk }`。
4. **目标字段**：弹层编辑 `studioDraft.goal`（工作流定义），禁止回填 `pendingGoal`。
5. **按钮**：页脚「返回修改 / 确认保存」；删除 body 内游离保存按钮。
6. **工具栏文案**：`测试运行` → `检查流程`。

## Risks

- 已有依赖「测试运行即启动」的路径需确认仅工作室工具栏变更；`openAgentGraph` 启动路径保留。
- 动画期间用户拖节点：检查中禁用拖拽或结束后清状态类。
