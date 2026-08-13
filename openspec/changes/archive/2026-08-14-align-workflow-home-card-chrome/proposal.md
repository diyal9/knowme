## Why

工作流首页货架卡与「维护我的工作流」管理卡视觉语言分裂：首页信息区层级不稳，管理卡右上角复制/编辑/删除又容易被误当成首页也应有的操作，扫读成本高。需要统一卡片上半区与简要流程分区，同时保留首页「可运行」页脚，并把「更新于」改成更准确的「模板修改于」。

### 目标用户

- 主：在工作流首页挑选并启动流程的知识工作者
- 次：在管理页维护个人副本的进阶用户

### 商业化与体验价值

货架是主入口；与管理卡统一 chrome 可降低认知切换成本，首页只保留运行入口可强化「发现 → 启动」转化，时间文案说清「改的是模板」避免误解为任务运行记录。

## What Changes

- 工作流首页货架卡上半区与简要流程分区对齐管理卡整体样式（图标井、标题行、说明、输入/产出条、底部分区简要流程）
- 首页卡保留图1页脚：左侧「N 步 · 模板修改于 {相对时间}」，右侧仅「开始运行」图标按钮
- 页脚时间文案由「更新于 …」改为「模板修改于 …」
- 工作流首页卡 MUST NOT 展示管理页右上角的复制 / 编辑 / 删除菜单按钮（管理页保留）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：货架首页卡 MUST 采用与管理卡一致的主体分区样式；页脚 MUST 使用「模板修改于」文案并仅保留运行按钮；MUST NOT 露出管理菜单。

## Impact

- `src/workbench.js`：`shelfCardHtml` / `shelfFooterMetaHtml`
- `src/workbench-shelf.css`：货架卡 chrome 与管理卡对齐
- `tests/workbench-templates.test.js`：文案与结构断言
- 证据：`openspec/changes/align-workflow-home-card-chrome/evidence/`

## 验收标准

1. 工作流首页卡视觉分区接近管理卡（上半信息 + 下半简要流程），但右上角无复制/编辑/删除
2. 首页卡页脚左侧为「N 步 · 模板修改于 …」（有有效时间戳时），右侧仅绿色运行按钮
3. 管理页卡仍保留复制 / 编辑 / 删除
4. `npm test` + `npm run lint` 通过

## 非目标（Non-goals）

- 不改 workflow package schema / IPC
- 不改管理页操作语义与确认删除流程
- 不按时间重排货架
- 不重做 Studio 画布节点卡
