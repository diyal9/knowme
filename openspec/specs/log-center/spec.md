# Spec: log-center

日志中心（`src/log-viewer.html`）按天展示统一日志，支持分类页签、级别筛选、搜索与「按对话合并」视图。

## 按 runId 合并同一次对话的日志

日志中心 SHALL 把同一 `runId` 的日志条目合并为一个可展开的分组卡片。

### 多轮对话合并为一张卡片

- **WHEN** 当前列表中存在同一 `runId` 的 2 条及以上日志
- **THEN** 这些条目 SHALL 合并为一张分组卡片，卡片在列表中的位置由该组最新条目的时间决定
- **AND** 卡片默认折叠，不展示逐条明细

### 展开查看多轮明细

- **WHEN** 用户点击分组卡片头部
- **THEN** 卡片 SHALL 展开并按时间正序展示该组全部条目
- **AND** 当条目带 `meta.round` 时 SHALL 以「第 N 轮」分隔线区分轮次
- **AND** 每个条目保持原有的点击展开查看 JSON 详情能力

### 键盘展开折叠

- **WHEN** 用户用 Tab 聚焦分组卡片头部并按 Enter 或 Space
- **THEN** 卡片 SHALL 展开或折叠，且 `aria-expanded` SHALL 同步当前状态
- **AND** 单条日志条目的标题行 SHALL 具备同样的键盘展开能力

### 分组汇总信息

- **WHEN** 分组卡片渲染
- **THEN** 卡片头 SHALL 展示轮次数、条目数、模型名（若有）、时间跨度与起止时间
- **AND** 轮次数 SHALL 为当前卡片内实际出现的不同轮号数量，筛选后不得声称包含未展示的轮次
- **AND** 组内存在 warn/error 时，卡片头级别徽标 SHALL 显示组内最高级别

## 合并视图开关

日志中心 SHALL 提供「按对话合并」开关，允许退回平铺列表。

### 关闭合并

- **WHEN** 用户关闭「按对话合并」
- **THEN** 列表 SHALL 恢复逐条平铺展示
- **AND** 该选择 SHALL 持久化，重开日志中心后保持

### 不产生空壳分组

- **WHEN** 某 `runId` 在当前列表中只有 1 条日志，或条目没有 `runId`
- **THEN** 该条目 SHALL 以原有单条形式展示，不包裹分组卡片

## 来源

Synced from `openspec/changes/archive/2026-07-30-log-viewer-run-grouping/specs/log-center.md`
