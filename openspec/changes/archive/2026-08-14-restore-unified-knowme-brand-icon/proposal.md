## Why

现有双层气泡 KM 图标同时承载便签、对话、字母和连接节点，缩小后层级拥挤，且不能准确覆盖 KnowMe 已扩展到记忆、知识与能力平台的产品定位。用户已确认改用更简洁的连接标志：深蓝圆角载体承载五节点连接路径，以单一珊瑚节点表示记忆起点，并在所有应用入口保持一致。

### 目标用户

- 在 Windows 10/11 使用 KnowMe 标题栏、任务栏和系统托盘入口的个人与团队用户。

### 验收标准

- 主 `icon.png`、Windows ICO 全尺寸帧、标题栏、任务栏和托盘均使用同一连接标志。
- 图标仅保留深蓝圆角载体、米白连接路径和单一珊瑚起点，不再出现便签尾巴、双层卡片或可读 KM 字母。
- 所有尺寸保留透明圆角与安全留白，主体视觉尺寸与相邻系统图标一致。
- 16–48 px 使用逐尺寸光学校正的原生帧；托盘使用 32 px 的 2× 高清表示。
- 图标更新后重启即可生效，无需用户清理 Windows 图标缓存。

### 非目标（Non-goals）

- 不修改应用窗口布局、标题栏高度、页面 CSS 或悬浮助手按钮。
- 不引入运行时图标绘制、额外依赖或新的 IPC。
- 不调整其他活跃 change 的功能范围。

## What Changes

- 以确定性的矢量几何重建已确认的连接标志，并同步 SVG 源文件。
- 重新生成 `icon.png`、Windows 16/24/32/48/64/128/256 px ICO 帧和 32 px / 2× 托盘资源。
- 修正图标辅助模块与注释，使主图标、ICO 和托盘资源各自读取对应文件。
- 更新自动测试，验证统一配色、透明安全区、视觉占比和高 DPI 托盘加载方式。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `knowme-brand`: 所有应用级入口必须使用统一的五节点连接标志，并提供逐尺寸优化的 Windows 表示。

## Impact

- 代码：`scripts/build-icon-refine.py`、`src/lib/app-icon.js`、图标加载注释与品牌资源验证测试。
- 源文件：`assets/brand-src/knowme-icon.svg`。
- 资源：`src/assets/icon.png`、`src/assets/icon.ico`、`src/assets/tray-icon.png`。
- 系统：Windows 标题栏、任务栏、系统托盘，以及打包后的 Windows/macOS 应用图标。
- 依赖：沿用 Pillow 与现有内容寻址缓存机制，不新增依赖。
