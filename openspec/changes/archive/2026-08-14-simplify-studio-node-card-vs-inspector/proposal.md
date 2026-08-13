## Why

编排画布节点卡片内嵌了「执行专家 / 输入 / 知识库」等可编辑控件，选中后右侧属性面板又重复同一批字段。双入口编辑让用户不知该改哪边，卡片也显得臃肿，破坏「一眼看懂拓扑」的编排心智。

## What Changes

- 画布节点改为**只读摘要卡**：标题、类型、关键配置摘要（已绑专家名、知识库名、输入提示等），去掉卡片上的 select / input / textarea 表单
- **编辑统一到右侧属性面板**：执行专家、知识库、检索目标、输入输出等仅在 Inspector 可改
- 选中节点时自动展开/聚焦属性面板；未选中时卡片仍能扫读配置状态
- 修正先前「specialty 节点必须在卡片上暴露执行专家控件」的要求：改为卡片展示绑定摘要，编辑在属性面板

## 目标用户

编排工作流的作者（非开发者也可）：需要快速理清图结构，再点进节点改配置。

## 验收标准

- 知识库 / 工具 / 大模型 / 专家节点卡片上**无可编辑**下拉或输入框（标题可保留只读或仅头栏轻量改名，二选一以 design 为准）
- 卡片能扫读到：类型、已绑专家（或「未绑定」）、知识库/技能等关键摘要
- 选中节点后，属性面板出现完整可编辑字段且与卡片摘要同源
- 未绑专家时保存/试跑仍 fail-closed，且属性面板字段明显可配
- 画布更紧凑：默认节点高度明显小于当前内联表单版

## 非目标（Non-goals）

- 不改 runtime 编译规则、校验码与边/端口交互
- 不引入第三方图编辑器
- 不做「双击节点弹模态编辑」
- 不改轻量步骤列表模式的交互

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-composition-studio`：专业画布节点展示与编辑职责分离——卡片摘要、Inspector 编辑

## Impact

- `src/lib/workbench-studio-canvas.js` — fields/sections/尺寸改为摘要投影
- `src/workbench.js` — 去掉画布 inline 编辑渲染与事件；Inspector 保持完整表单
- `src/workbench-console.css` / `workbench-shelf.css` — 摘要卡样式
- `tests/workbench-studio-canvas.test.js` 及相关静态契约
- 与 `surface-specialty-node-expert-bind` 要求冲突处以本 change 为准（摘要可见 + Inspector 编辑）
