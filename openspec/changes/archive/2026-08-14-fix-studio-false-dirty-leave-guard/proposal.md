## Why

货架上点击「编辑」会误弹「这条工作流还没保存」。根因是专业画布渲染时 `ensureFreeGraph` 把线性图升级为自由图并强制 `dirty=true`，即使用户未改任何内容；保存后若再渲染，脏草稿仍留在内存，从货架切到另一条工作流就会触发离开确认。

## What Changes

- 渲染态把草稿升级为自由图时 MUST NOT 标记为未保存。
- 离开确认只在存在真实业务节点且 `dirty` 时打断；仅有开始/结束系统节点不算。
- 保存成功并回到货架后 MUST 清除脏标记（或丢弃内存草稿），避免货架「编辑」误弹确认。

## Capabilities

### Modified Capabilities

- `agent-composition-studio`: 澄清「未保存」仅指用户编辑，不含画布归一化；货架编辑入口不得被幽灵脏草稿打断。

## Impact

- `src/lib/workbench-studio-model.js` — `ensureFreeGraph` 支持不强制 dirty
- `src/workbench.js` — 渲染/保存/离开门禁
- 单测覆盖假 dirty 与离开门禁
