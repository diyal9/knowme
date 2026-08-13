## Why

`restore-unified-knowme-brand-icon` 已把系统层图标（窗口、任务栏、托盘、打包产物）统一成「深蓝圆角载体 + 米白五节点连接路径 + 单一珊瑚起点」，但当时把悬浮助理列为非目标，应用内「KnowMe 助理」面板头像仍停留在旧的三节点斜线标记：节点数、走向、珊瑚点位置、载体配色和圆角都与系统图标不同。用户在工作台看到的助理头像与任务栏/托盘图标对不上，品牌辨识被切成两套。

### 目标用户

- 在 Windows 上同时看到任务栏/托盘图标与工作台悬浮助理面板的 KnowMe 个人与团队用户。

### 验收标准

- 助理面板头像使用与 `assets/brand-src/knowme-icon.svg` 完全相同的节点坐标与连线拓扑（四个米白节点 + 一个珊瑚起点，非交叉路径）。
- 头像载体使用与应用图标一致的深蓝 `#172535` 与等比圆角，珊瑚起点使用 `#F05D4E`。
- 标记在 36 px 头像内的视觉占比与应用图标中标记占载体的比例相当，四周留白不拥挤。
- 悬浮触发按钮仍是铃铛（`use-bell-for-assistant-fab` 的既有结论），本次不改。

### 非目标（Non-goals）

- 不修改 `src/assets/` 下任何图标位图、ICO 帧或托盘资源。
- 不修改悬浮按钮字形、拖拽、徽标、presence 动画或面板交互逻辑。
- 不引入新的图片资源、构建步骤或 IPC。

## What Changes

- 用应用图标母版的几何重绘助理面板头像 SVG：四节点连接路径 + 珊瑚起点，viewBox 直接沿用母版坐标系并裁到标记包围盒。
- 对齐头像载体配色与圆角到品牌规范，并把珊瑚色语义从「中心节点」改为「记忆起点」。
- 清理仅服务旧三节点标记的 `.km-fab-mark-node-center` 死样式。
- 增加回归测试：面板标记的节点坐标与 SVG 母版逐一比对，防止两套几何再次分叉。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `knowme-brand`: 品牌标记的一致性要求从系统层图标扩展到应用内渲染的品牌标记表面。

## Impact

- 代码：`src/workspace.html`（悬浮助理面板头像 SVG 与相关 CSS）。
- 测试：`tests/workspace-agent.test.js`。
- 资源：无变更，仅以 `assets/brand-src/knowme-icon.svg` 为几何真值来源。
- 渲染进程：纯静态 SVG/CSS，无新增运行时开销。
