## Why

能力 Hub 属于高频能力扩展入口，但当前被分隔到自动化入口下方，导航层级与使用频率不匹配。将两者互换后，能力 Hub 与办公助理、工作台保持连续，自动化则作为次级工具入口独立呈现。

## What Changes

- 将左侧 rail 的能力 Hub 图标移动到工作台图标之后。
- 将自动化图标移动到分隔线下方原能力 Hub 的位置。
- 保留两个入口原有图标、提示、无障碍状态与点击行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: 调整左侧 rail 中能力 Hub 与自动化入口的视觉顺序和分组。

## Target Users

- 使用办公助理、工作台、能力 Hub 与自动化中心的所有 KnowMe 用户。

## Acceptance Criteria

- 左侧 rail 从上到下依次为办公助理、工作台、能力 Hub、分隔线、自动化。
- 能力 Hub 与自动化入口的图标、tooltip、aria-label、选中态及点击行为不变。
- 导航契约测试与 lint 通过。

## Non-goals

- 不更换图标造型。
- 不改变能力 Hub 或自动化中心内部功能。
- 不调整知识库与设置入口。

## Impact

- 影响 `src/workspace.html` 的 rail DOM 顺序及对应静态契约测试。
- 无 API、数据、IPC 或依赖变更。
