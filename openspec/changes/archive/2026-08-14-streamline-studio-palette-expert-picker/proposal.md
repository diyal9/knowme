## Why

编排 Studio 左侧「节点 / 配置」双 Tab 冗余：配置侧仅列出已保存工作流，管理区已覆盖该能力；组件两列网格 + 长专家列表占位高，侧栏臃肿。添加专家应面向「工作台已绑定专家」，并支持多选，而不是在窄侧栏平铺长清单。

## What Changes

- 去掉 Studio 侧栏「配置」Tab 与「已保存」列表
- 节点组件改为**单列分区**展示（流程边界 / 能力 / 控制）
- 去掉侧栏内嵌专家列表与搜索
- 点击「专家」打开二级弹窗：列出**已添加到工作台**的专家；卡片形态对齐专家库/快捷任务卡；支持多选（勾选图标）；确认后批量把专家节点加入画布
- 「库」按钮保留，用于跳转专家库

## Capabilities

### Modified Capabilities

- `agent-composition-studio`：侧栏调色板与专家入图交互

## Impact

- `src/workspace.html`、`src/workbench.js`、`src/workbench-console.css`
- 静态契约测试（palette 列、lib-tab、expert picker）

## Non-goals

- 不改画布节点渲染与运行时编译
- 不改专家库本身
- 不在侧栏恢复「已保存工作流」入口（管理面板继续承担）
