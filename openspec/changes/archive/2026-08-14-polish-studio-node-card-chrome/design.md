## Context

See proposal.md — Why。专业画布摘要卡已由 `simplify-studio-node-card-vs-inspector` 落地：`wb-studio-flow-head` + `wb-studio-flow-sections`，类型仅用 `border-top: 3px` 区分。渲染进程纯 CSS/轻量 HTML class，无 IPC。

## Goals / Non-Goals

**Goals:**

- 全宽类型色头栏，一眼辨类型
- 正文标签弱、取值强；空态/警示用类型色或 warn 强调
- 选中蓝框与类型色共存

**Non-Goals:**

- 不改 sections 数据结构语义与 Inspector
- 不改 sizeForNode 算法逻辑（高度若因 padding 微调可接受）
- 不引入 CSS 变量体系重构全工作台

## Decisions

### 1. 头栏：浅色 tint 全宽底 + 同色文字，而非实心深色条

- **选择**：每种 kind 用低饱和 tint 背景（如 tool `#f4ead8`）+ 深色标题（`#7a5418`），图标改为白/半透明底叠在同色系上。
- **理由**：实心深色条上小字对比差，且与选中蓝框抢戏；浅 tint 既「整条上色」又保持可读。
- **备选**：实心主题色头栏白字 → 拒绝（小字对比与操作按钮可读性差）。

### 2. 去掉 `border-top: 3px`，改由头栏底色承担类型信号

- **选择**：`.kind-*` 不再设顶边色条；头栏 `border-bottom` 可用更淡的同色分隔。
- **理由**：双信号冗余且顶边在圆角裁剪下几乎看不见。

### 3. 正文层次：CSS 为主，warn 沿用既有 `tone`

- **选择**：`.wb-studio-flow-section-head` 更淡更小；`.wb-studio-flow-kv-key` / `.wb-studio-flow-section-text` 加粗加深；`.is-warn` 用类型无关的琥珀强调（已有）并可略加字重。已配置行保持深灰正文。
- **理由**：`tone: warn` 已由 canvas lib 产出，无需改数据结构；纯 CSS 即可拉开层次。
- **备选**：给每行加 `emphasis` 字段 → 过度工程，拒绝。

### 4. Electron 边界

- 仅渲染进程 CSS（+ 如有必要极小 HTML class）。无主进程、无 IPC、无额外内存。

## Risks / Trade-offs

- [Risk] 头栏 tint 与画布点阵底对比不足 → Mitigation：各 kind 饱和度略高于当前 icon 底色。
- [Risk] 选中蓝边 + 彩色头栏过花 → Mitigation：选中只加蓝 ring，头栏色不变。
- [Trade-off] 浅 tint 不如实心色「炸」→ 换可读性与专业感，符合编排主路径。

## Migration Plan

- 纯样式；回滚 CSS 即可。
