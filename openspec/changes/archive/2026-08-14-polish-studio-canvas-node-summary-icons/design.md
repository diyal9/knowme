## Context

画布节点摘要已由 `simplify-studio-node-card-vs-inspector` 改为只读；调色板已用 `StickyIcons` + `data-icon`，但节点头栏仍写死 Unicode。摘要行把值与类型拼成「长文案 · string」，再叠加头栏高度低估，导致裁切观感。

## Goals / Non-Goals

**Goals**

- 节点 kind → 图标与调色板共用同一映射
- 摘要只展示重点字段与短文案；溢出用省略 / 「等 N 项」
- 高度预算覆盖头栏，正文不被底边切断

**Non-Goals**

- 不改 Inspector、校验、边编辑
- 不新增图标字形（仅用现有 `ui-icons.js`）

## Decisions

1. **图标映射**（与 `renderStudioPalette` 一致）  
   `start→play` · `end→square` · `agent→users` · `llm→optimize` · `tool→component` · `knowledge→bookOpen` · `condition→workflow` · `join→network` · `gate→clipboardCheck`  
   抽成 `studioKindIcon(kind)`，palette 与 canvas 共用。

2. **摘要优先级**  
   - start/end：最多 2 行 IO 标签；超出追加「等 N 项」；不再拼 ` · string`  
   - agent：优先「执行专家」「目标」；「输入」仅在非占位文案时展示；「输出」默认收进 Inspector  
   - gate：确认说明一行短摘要；卡片宽度 ≥ 200  
   - 通用行长：rows ≤ 40 字，text ≤ 72 字（完整内容在 Inspector / title 悬停）

3. **尺寸**  
   - `sizeForNode` 头栏基数改为 ~56  
   - 仍 `overflow:hidden` + 行级 ellipsis，避免半截字

## Risks / Trade-offs

- 少显示字段可能让用户以为「丢了配置」→ 靠 Inspector 与悬停 title 补全  
- 已保存节点若写死旧宽高，重新投影时以 `visualNodeFromDraft` 重算为准

## Migration Plan

无数据迁移；打开/重渲染画布即生效。
