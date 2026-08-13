## Why

当前「编排工作流」在第一轮已升为节点画布，但仍以 relation 派生边为主，不足以表达 agentUniverse 式自由拓扑与 LLM / Tool / Knowledge / 条件节点心智。KnowMe 运行时必须继续确定性管理 Run，扩展只能编译进既有节点类型（agent / condition / join / gate / terminal）。

## What Changes

- Studio 专业模式进入 **自由图（free graph）**：显式 `edges`、可拖节点坐标、端口手绘连线；保存后可经 `layout` 还原。
- 节点类型扩展：`llm` / `tool` / `knowledge` / `condition`（另有既有 `agent` / `join` / `gate` / start-end）。
  - `llm|tool|knowledge` → 编译为 runtime `agent` + `studioKind` 与 profile 叠加（prompt / skill / knowledge），**必须绑定本地专家**。
  - `condition` → runtime `type: condition` + 分支边 `branch: true|false`。
- 轻量模式仍为步骤列表 + relation；专业模式 `ensureFreeGraph` 兼容旧草稿。
- Runner：条件求值、未选分支节点 skip，避免死锁。
- 调色板可添加扩展节点；Inspector 按类型配置；保存前 `validateDraft`。

## Capabilities

### Modified Capabilities

- `agent-composition-studio`：自由端口连线、扩展节点类型、编译与校验规则。

## Impact

- `src/lib/workbench-studio-model.js`、`workbench-studio-canvas.js`
- `src/workbench.js`、`workspace.html`、`workbench-console.css`
- `src/lib/agent-package-runtime.js`、`workbench-agent-graph.js`、`agent-team-workflow-runner.js`
- 测试：`workbench-studio-*.test.js`

## Non-goals

- 不引入 React Flow / 外部图编辑器。
- 不做完整表达式引擎与 `{{node.field}}` 变量 UI（条件仅 equal/not_equal/contains/blank）。
- 不把 Python AutoGen 作为运行时依赖。
