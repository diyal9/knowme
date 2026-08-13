## Context

现有 `ensureTaskManageModal` / `openTaskManageHub` 在渲染进程用静态 HTML 列表勾选并调用 `workbenchTaskArchive`。专家头像已有 `agentAvatarMark` + `availableExperts()`。无需改主进程 schema。

## Goals / Non-Goals

**Goals:**
- 底栏策略按钮组：全选 / 已完成 / 超过 1 个月 / 超过 3 个月 / 清空
- 卡片：checkbox + 头像 + 标题 + 专家行 + 状态 + 进度 `<details>`/button toggle
- 纯渲染层逻辑；年龄阈值用本地 `Date.now()` vs `updatedAt`

**Non-Goals:**
- 不新增 IPC；不改任务存储；不做服务端筛选

## Decisions

1. **年龄字段用 `updatedAt`**：清理「久未更新」任务；缺省回退 `createdAt`。
2. **策略替换勾选而非累加**：与「全选」语义一致，避免叠加困惑。
3. **进度用 `<details>`**：无额外状态、键盘可达；摘要用 `taskRecentSummary`。
4. **专家解析**：`availableExperts().find(id)`，无匹配时用 `{ id, name: expertName }` 喂给 `agentAvatarMark`。
5. **点击隔离**：进度 toggle / details 点击 `stopPropagation`，避免误触 checkbox 的 label。

## Risks / Trade-offs

- [无匹配专家] → 名称兜底 + 语义图标，不阻断管理
- [列表很长时 details 展开] → 默认收起；仅单卡展开

## Migration Plan

无数据迁移。回滚即还原弹窗 HTML/CSS。
