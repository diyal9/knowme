## Why

用户一键对齐画布后点保存，节点坐标未写入 Workflow Package，重载后看起来像「还原成堆叠原样」。保存应保留自由图画布布局。

## What Changes

- 保存链路保留 `graph.layout` 与节点 `x`/`y`（含开始/结束）。
- Agent Graph 编译与 Workflow Package 归一化不得剥掉布局字段。
- 保存成功后回到编排时，节点位置与保存前一致。

## 目标用户

在专业画布调整节点位置后需要中途存档的编排用户。

## 验收标准

- 一键对齐 → 保存 → 仍为对齐后的横排（或等价坐标），状态「已保存」。
- 离开再点编辑，布局与保存时一致。
- 无布局的旧包仍可打开（回退自动排布）。

## 非目标（Non-goals）

- 不改一键对齐算法本身。
- 不改运行时执行对 layout 的依赖（layout 仅编辑器 UI）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-composition-studio`: 自由图保存 MUST 持久化画布坐标。

## Impact

- `src/lib/workflow-package.js` · `src/lib/workbench-agent-graph.js` · `src/workbench.js`
- 单测：布局 round-trip
