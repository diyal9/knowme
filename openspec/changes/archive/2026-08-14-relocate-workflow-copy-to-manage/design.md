## Context

货架卡 `shelfCardHtml` 目前在运行旁按来源放次按钮：团队 → fork，个人 → edit。管理卡 `workflowManageItemHtml` 仅有 edit / delete。See proposal.md - Why。

## Goals / Non-Goals

**Goals:**
- 货架卡 footer 只渲染运行按钮
- 管理卡在 edit 前插入 copy，走既有 `forkWorkflowPackage`
- 提示文案与模板测试对齐

**Non-Goals:**
- 不为官方流程重建货架 fork 入口
- 不改 fork API

## Decisions

1. **管理面复制 = 复用 `forkWorkflowPackage`**  
   个人/派生包同样可 fork 出新副本，避免新 IPC。  
   备选：仅 clone graph 的本地 API — 成本高，否决。

2. **货架个人卡一并去掉编辑图标**  
   与「首页只留运行」一致；编辑已在管理面。  
   备选：个人卡保留编辑 — 与截图诉求不一致，否决。

3. **按钮顺序：复制 · 编辑 · 删除**  
   复制紧挨编辑（用户图示），删除保持危险态靠右。

## Risks / Trade-offs

- [Risk] 官方流程暂无货架「复制并调整」入口 → Mitigation：管理面 hint/空态改为「新建工作流」；后续 change 可补官方派生路径
- [Risk] 模板测试硬编码 `data-flow-action="fork"` → Mitigation：断言迁到管理卡 `data-workflow-manage="fork"`
