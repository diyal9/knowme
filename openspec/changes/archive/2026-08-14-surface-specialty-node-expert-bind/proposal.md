## Why

编排画布上拖入「知识库 / 工具 / 大模型」后，保存与测试运行会报「需要绑定本地专家」，但节点卡片内联表单没有「执行专家」控件；用户只能在右侧属性面板里找，容易漏配并被硬拦截。

## What Changes

- 专业画布内联字段为 `llm|tool|knowledge` 增加「执行专家」选择（`agentPackageId` / `select-expert`）
- 从调色板添加上述节点时，若工作台已有本地专家，默认预填第一位可执行专家（仍可改）
- 校验规则不变：保存/试跑仍要求绑定本地专家 Package

## Capabilities

### Modified Capabilities

- `agent-composition-studio`：专业画布 specialty 节点 MUST 在卡片上暴露执行专家绑定

## Impact

- `src/lib/workbench-studio-canvas.js`
- `src/workbench.js`
- `tests/workbench-studio-canvas.test.js`
