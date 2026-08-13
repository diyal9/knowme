## Why

编排工作流 Studio（图2 三栏壳：节点库 + 画布 + 属性）已具备自由图与扩展节点类型，但画布节点仍是「标题 + 一行摘要」的极简卡片。对照 agentUniverse workflow 画布（图1），编排者无法在图上扫读入参 / Prompt / 出参 / 绑定配置，必须频繁点选右侧 Inspector，扫图效率与专业感不足。

本变更把 **agentUniverse 节点卡片视觉语言** 落到 KnowMe 现有壳内：保留三栏与确定性 Runtime，不引入 Python/外部图编辑器。

## What Changes

- 专业画布节点升级为 **分节富卡片**（header 色标 + 输入 / 配置 / Prompt / 输出等只读摘要节）
- 按节点类型差异化展示（开始入参、大模型 Prompt、工具/知识绑定、条件表达式、结束出参）
- 卡片尺寸与布局模块自适应分节高度；贝塞尔连线高亮为 AU 风格冷蓝主色
- 深度编辑仍在右侧属性面板；卡片以概览为主（点击整卡选中）
- 同步单测与 dev-self-test 证据

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `agent-composition-studio`：专业画布节点必须呈现 agentUniverse 式分节摘要，而非单行 meta。

## Impact

- `src/lib/workbench-studio-canvas.js`（视觉模型与尺寸）
- `src/workbench.js`（`studioCanvasNodeHtml`）
- `src/workbench-console.css`（富卡片样式、边线色）
- `tests/workbench-studio-canvas.test.js`
- 证据：`openspec/changes/agentuniverse-style-workflow-cards/evidence/`

## 目标用户

- 使用「编排工作流」专业画布搭专家协作/工具链的产品用户与内部 demo

## 验收标准

1. 专业画布上，专家 / 大模型 / 工具 / 知识库 / 条件 / 开始 / 结束节点均能读到 ≥1 个分节摘要（开始可显入参名）
2. 选中态、端口拖线、删除/右键、保存/测试运行路径不回归
3. `npm test` + `npm run lint` 通过
4. 不引入 React Flow / X6 / agentUniverse 运行时依赖

## 非目标（Non-goals）

- 不在节点卡片内做完整表单内联编辑（属性仍由 Inspector 负责）
- 不实现 `{{var}}` 变量引用完整 UI 与表达式引擎
- 不接入 agentUniverse Python 运行时
- 不改轻量步骤列表模式的主交互（可允许样式共存）
