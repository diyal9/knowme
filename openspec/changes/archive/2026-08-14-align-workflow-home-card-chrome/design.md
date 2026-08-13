## Context

工作流货架卡（`shelfCardHtml`）与管理卡（`workflowManageItemHtml`）已各自具备输入/产出条与简要流程，但 DOM 分区与 chrome 不一致：货架用 `header` + `card-bottom`，管理用 `manage-top` + `manage-bottom`；货架页脚文案为「更新于」。变更仅触及渲染进程 UI（`workbench.js` / `workbench-shelf.css`），无 IPC / schema 变更。See proposal.md - Why。

## Goals / Non-Goals

**Goals:**
- 货架卡结构对齐管理卡两分区（上半信息、下半简要流程）
- 首页保留页脚 meta + 仅运行按钮；文案改为「模板修改于」
- 首页不渲染管理菜单按钮

**Non-Goals:**
- 不合并两套 HTML 为单一组件工厂（可共享 class/样式即可）
- 不改管理卡操作区与删除确认

## Decisions

1. **结构对齐用管理卡分区模型，不抽公共渲染函数**  
   - 货架改为 `wb-shelf-card-top`（mark + copy：标题行/说明/chips）+ `wb-shelf-card-bottom`（简要流程 + footer）。  
   - 标题行右侧放 provenance badge，**不**放 manage actions。  
   - 备选：共用 `workflowCardShellHtml(surface)` — 收益小、回归面大，本轮不做。

2. **页脚文案「模板修改于」仅改展示字符串**  
   - 仍用 `shelfUpdatedParts` / `updatedAt|createdAt`；`title` 绝对时间不变。  
   - 备选：改相对时间算法 — 无产品需求，不做。

3. **管理菜单仅出现在管理页**  
   - 货架 `shelfCardHtml` 继续禁止 `data-workflow-manage` / fork/edit/delete。  
   - 测试断言加固。

4. **Electron 边界**  
   - 纯渲染层 class/文案；主进程与 preload 不变，无新增 IPC，不影响启动路径与内存。

## Risks / Trade-offs

- [货架 DOM 结构调整导致既有 CSS/测试选择器失效] → 同步更新 `workbench-shelf.css` 与 `workbench-templates.test.js`
- [去掉左侧色条后领域辨识变弱] → 保留领域色 mark 井；色条改为可选弱化或移除以贴近管理卡

## Migration Plan

热更即可；无数据迁移。回滚：还原 `shelfCardHtml` / CSS / 文案字符串。
