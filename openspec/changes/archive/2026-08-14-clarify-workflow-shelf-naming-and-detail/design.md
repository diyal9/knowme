## Context

See proposal.md — Why。货架渲染集中在渲染进程 `src/workbench.js`（`shelfCardHtml` / `renderShelf`），点击目前只绑定 `[data-flow-action]`。工作台已有居中弹层 `#wbWorkflowModal`（`wb-modal-mask` + `wb-modal`），与 `secondary-dialog-system` 的居中二级弹窗约定一致，可复用而不引入新依赖。

进程边界：本次纯渲染层展示与交互；不新增 IPC、不改主进程 package 读写。

## Goals / Non-Goals

**Goals:**

- 提供纯函数级 `workflowDisplayName(item)`（或等价）供货架、运行标题、管理列表、详情弹层共用。
- 卡片点击分区：body → 详情；`use` → 运行；`fork`/`graph` → 既有动作。
- 复用 `#wbWorkflowModal` 承载详情，符合既有居中/遮罩/Escape 行为。
- 次要操作图标化，沿用 `StickyIcons` + `data-icon`。

**Non-Goals:**

- 不改 `workflow-package-store` / fork 持久化 `name`。
- 不重做 Run 三段 IA，不新建抽屉组件。
- 不在主进程做展示名映射。

## Decisions

### 1. 展示名只在渲染层映射

- **选择**：按 `id` 优先查短名表，再对通用模式做启发式（去掉 `（我的版本）`；`A → B` / `A — B` 取产出侧或拼接为结果短名），最后回退原 `name`。
- **理由**：用户明确要求只改展示层；持久化名可能被仓库/Daemon 引用。
- **备选**：改 seed / fork 写入名 → 否决，违反决策且影响已有个人副本比对。

建议内置 id 映射（可随实现微调文案，但不改 package）：

| id | 展示短名 |
|---|---|
| `office-meeting-to-actions` | 会议纪要与待办 |
| `engineering-delivery` | 研发交付 |
| `visual-brief-to-export` | 视觉 Brief 出图 |

启发式须对「同 id 的 fork 副本」与「同管道公式但无映射」同样生效；搜索 haystack 同时包含内部名与展示名。

### 2. 详情用既有居中 `#wbWorkflowModal`

- **选择**：填充 `wbModalTitle` / `wbModalBody`，主按钮「开始运行」（可运行时），次要「关闭」；不可运行时主按钮 disabled 并展示缺失项。
- **理由**：已是居中二级弹层，避免再做一个抽屉或平行 modal。
- **备选**：能力中心式右侧抽屉 → 用户已否决；新建专用 dialog DOM → 增加重复样式，无必要。

详情正文字段（只读投影现有 package 字段）：

- 一句话：`description` / 产出摘要
- 需要：`inputs[]`
- 产出：`outputs[]`
- 步骤/专家：`graph.nodes` 或 `agentRefs`
- 可运行性：现有 `shelfReadiness`

### 3. 点击分区

```
card click
  ├─ [data-flow-action] → handleFlowLibraryAction（stopPropagation）
  └─ card body          → openWorkflowDetail(id)
```

卡片可设 `tabindex="0"`，Enter/Space 打开详情（按钮除外）。

### 4. 图标按钮

- `fork` → `copy`（或现有最接近图标），`aria-label="复制并调整"`
- `graph` → `edit` / `pencil`，`aria-label="编辑"`
- `use` 保持文字「开始」/「暂不可用」
- 挂载：`StickyIcons.mount`（货架已有）

### 5. 性能

- 展示名与详情 HTML 均为同步字符串拼接，无额外网络；弹层按需填充，不预渲染全部详情。

## Risks / Trade-offs

- [启发式短名误伤自定义标题] → 仅在存在管道分隔符或已知后缀时改写；普通短名原样显示；id 表优先。
- [复用 wbWorkflowModal 与其它确认流冲突] → 打开详情前复用现有 modal 占用检查；详情模式用明确 footer 状态，关闭时复位。
- [纯图标可发现性] → 强制 `title` + `aria-label`；主 CTA 保留文字。

## Migration Plan

- 无需数据迁移；纯 UI。
- 回滚：恢复卡片渲染与点击绑定即可，无持久化副作用。

## Open Questions

无（展示层短名 + 居中弹层已由用户确认）。
