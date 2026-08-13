## Why

编排侧栏「组件」标题旁的「库」按钮语义偏离：用户是在选专家，却在组件栏被带到专家库。应把入口收进点「专家」后的「选择工作台专家」二级弹窗，与「添加到工作台 → 再选专家入画布」路径一致。

## What Changes

- 移除 Studio 组件栏「库」按钮
- 在「选择工作台专家」弹窗提供「专家库」图标+文字按钮
- 从该入口进入专家库；关闭专家库后自动回到选择弹窗，并刷新工作台已绑定专家列表

## Capabilities

### Modified Capabilities

- `agent-composition-studio`：专家入图二级弹窗承载专家库入口与返回续选

## Impact

- `src/workspace.html`、`src/workspace.js`、`src/workbench.js`、`src/workbench-console.css`
- 相关静态契约测试
