## Why

任务栏上 KnowMe 图标的**感知尺寸偏小**——中部连线标记留白过大，且透明安全区偏宽时槽位占位感弱。用户诉求是：**在现有深蓝圆角载体 + 米白五节点 + 珊瑚起点上放大、填满、高清**，而不是换色或换图形。

## What Changes

- **保持原品牌配色与拓扑**（navy / ivory / coral origin）。
- 连接图绕中心约 **1.42× 放大**，线宽与节点同步加粗，透明边略收（42→24）以更贴满系统槽位。
- 逐尺寸直渲重生 `icon.png` / `icon.ico` / `tray-icon.png`（高清多帧）。
- 应用内助理头像几何同步（配色仍回原 navy 底 + coral 起点）。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `knowme-brand`: 明确系统图标在不改变品牌拓扑与色板的前提下，应使用放大后的连接图与更满的载体占位，并保持各 Windows 帧高清直渲。

## 目标用户

- Windows 任务栏用户，希望 KnowMe 与相邻应用视觉权重接近

## 验收标准

- 配色恢复为深蓝底 + 米白路径 + 珊瑚起点（非红底版本）
- 中部连线图明显大于改前；任务栏重启后为新 ICO
- brand-icon 与 avatar 相关测试通过

## 非目标（Non-goals）

- **不做**红/珊瑚满底板 redesign
- 不改产品功能与窗口框架

## Impact

- `assets/brand-src/knowme-icon.svg`、`scripts/build-icon-refine.py`
- `src/assets/icon.png`、`icon.ico`、`tray-icon.png`
- `src/workspace.html`、相关测试
