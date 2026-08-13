## Context

`#wbDaemonComposePath` 为原生 `<select>`。Electron/Chromium 下 `option` 几乎无法加 `border-bottom`，系统弹出层也无法用产品令牌控制。用户截图显示选项无分隔、扫读困难。

## Goals / Non-Goals

- Goals: 可样式化路径菜单；淡色行间分割线；交互与数据流不变。
- Non-Goals: 全站 select 替换；路径搜索/分组；改 Daemon API。

## Decisions

1. **自定义 combobox**：触发按钮复用现有 select 视觉（边框/圆角/focus ring）；菜单为绝对定位 listbox。
2. **保留隐藏 native select**（或等价 value 源）：选中后同步 value 并 `dispatchEvent('change')`，复用现有 `change` 监听（刷新 launch context → `renderDaemonMode`）。
3. **分割线**：选项 `border-bottom: 1px solid` 使用 `--daemon-line` 的淡化（如 `color-mix` / 低透明度），末项无底边；避免斑马纹与粗分隔。
4. **选中态**：用 `--daemon-accent` / soft 底，不用系统默认亮蓝，与管线服务视觉一致。

## Risks / Trade-offs

- 自定义控件需处理：外点关闭、Escape、禁用态、重渲染时菜单关闭。
- 比原生多一点 DOM；范围仅限交付路径字段，可接受。

## Migration Plan

无数据迁移；热重载/重启后即可验证。
