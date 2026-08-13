## Context

- 已有 `redesign-expert-workflow-node-canvas`：`graphMode:free`、扩展 kind、端口连线。
- 已有 `compact-workflow-studio-canvas-ux`：窄侧栏与紧凑布局。
- 当前卡片：`studioCanvasNodeHtml` 仅 head + 单行 `input → output`。
- 参考：agentUniverse workflow 画布（节点内嵌 Inputs / Prompt / Output 区块、彩色 type icon、贝塞尔边）。

## Goals / Non-Goals

**Goals**

1. 从 draft 节点投影出结构化 `sections[]`（标题 + 行列表 / 多行文本）。
2. 渲染 AU 风格分节卡片，尺寸随 kind 与摘要内容估算。
3. 边默认色改为冷蓝；保持端口、分支双出口、选中/拖拽/删除。
4. 编译与 Runtime 路径零变更（纯可视化层 + canvas 投影）。

**Non-Goals**

- 卡片内可编辑 textarea / 下拉
- React/X6 依赖

## Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 信息架构 | 卡片 = 概览，Inspector = 编辑 | 避免画布表单拖垮重绘与焦点 |
| 投影层 | `workbench-studio-canvas.visualNodeFromDraft` 产出 `sections` | 单测可对模型断言，UI 只渲染 |
| 高度 | 按 kind + sections 估算 fixed `h` | 免测 DOM 测量；过大内容 ellipsis |
| 宽度 | 执行类 240–280，控制类 168–200 | 接近 AU 可读宽度，仍兼容网格 |
| 边色 | `#5b8def` 主路径 | 对标 AU 蓝连线，分支色保留 |

## 节点分节映射

| kind | 分节 |
|------|------|
| start | 输入：draft.inputs 标签名（fallback `user_input`） |
| end | 输出：draft.outputs 或汇总结论文案 |
| agent | 输入摘要、目标/职责、输出摘要、Skills 计数 |
| llm | 模型、输入、Prompt 预览、输出 |
| tool | 输入、技能绑定、输出 |
| knowledge | 输入、知识库绑定、输出 |
| condition | 条件表达式、分支提示（成立/不成立） |
| join / gate | 一句说明 body |

## Risks

| 风险 | 缓解 |
|------|------|
| 卡片过大遮挡 | 行数 clamp（输入 ≤3、prompt ≤3 行、总高上限） |
| 旧单测尺寸硬编码 | 更新断言为最小宽高区间 |
| 拖线中点偏移 | 仍用节点中部端口；条件双出口保持现位置 |

## 实施落点

1. `canvas.js`：`SIZE` + `sectionsFromNode` + `sizeForNode`
2. `workbench.js`：`studioCanvasNodeHtml` 渲染 sections
3. `workbench-console.css`：`.wb-studio-flow-section*` 等
4. 测试覆盖 sections 与更大尺寸
