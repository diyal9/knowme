## Why

能力 Hub 的类型页签与工作台“首页 / 工作流”页签使用了不同的选中样式，造成同一产品内的导航语言不一致。统一页签可降低识别成本，并强化 KnowMe 绿色品牌状态。

## What Changes

- 将能力图标、“能力 Hub”标题、类型页签和关闭操作直接整合进工作区外层顶部栏，与工作台共用相同的单层导航结构。
- 能力 Hub 作为内嵌页面时隐藏自身菜单栏，消除“外层标题栏 + 内层菜单栏”的重复。
- 移除内容区重复的英文眉题、类型大标题、总数徽标和说明文案，让搜索与筛选直接承接顶部导航。
- 使用工作台同款绿色实底选中态、纯文字标签、圆角、边框和阴影。
- 保留现有 Tab 切换、深链、无障碍状态和响应式行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `capability-hub`: 类型 Tab 的可感知选中态必须与工作台一级页签保持一致。

## Target Users

- 在工作台与能力 Hub 之间切换的所有 KnowMe 用户。

## Acceptance Criteria

- Hub 外层顶部栏的高度、底色、边界、标题区域及内容顺序与工作台菜单栏一致。
- 页面顶部只出现一条菜单栏，不再额外显示独立的“能力 Hub”标题栏。
- 顶部栏下方不再重复展示当前类型标题、数量徽标和介绍文案。
- Hub 页签底板、选中态颜色、圆角、字号与工作台页签一致。
- 页签仅显示文字，不再混用类型图标。
- 三个 Tab 切换及 `aria-selected` 行为不变。
- 定向测试与 lint 通过。

## Non-goals

- 不调整能力目录、筛选器或卡片布局。
- 不修改工作台现有页签。
- 不改变 IPC、Catalog 或安装逻辑。

## Impact

- 影响 `src/workspace.html`、`src/workspace.js`、`src/capability-hub.html`、`src/capability-hub.css` 与对应契约测试。
- 无 API、数据和依赖变更。
