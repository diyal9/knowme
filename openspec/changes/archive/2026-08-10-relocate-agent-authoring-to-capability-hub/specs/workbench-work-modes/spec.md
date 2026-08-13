## REMOVED Requirements

### Requirement: Two work-mode tabs partition the workbench

**Reason**: 工作台回到单一工作流货架，Agent 迁至能力界面，两 Tab 模式整体退役。
**Migration**: 移除 `activeWorkMode` 与两 Tab DOM/路由；个人工作流并入单一货架并带「我的」标签；Agent 的浏览/创建/调优改由 capability-hub 承载。

### Requirement: Tabs split by object layer, not by provider

**Reason**: 划分维度整体取消（无 Tab）。
**Migration**: 同上。
