## Why

Windows 原生标题栏会把 KnowMe 的多尺寸图标压缩到约 16–20 px；当前小尺寸图形铺满整个画布，导致窗口左上角图标视觉贴边、像被裁切。修复后，用户在日常打开工作台和设置窗口时可获得更完整、稳定的品牌呈现。

## What Changes

- 为 Windows `.ico` 的 16/24/32/48 px 帧增加透明安全留白，保留 KM 小尺寸高对比造型。
- 为系统托盘 `tray-icon.png` 应用相同安全留白，避免 KM 在通知区域占满图标槽位。
- 使用内容寻址的本地图标文件名，避免 Windows 任务栏继续复用旧路径的缓存图标。
- 保持 64 px 及以上应用图标、主 `icon.png` 与页面内品牌资产不变。
- 增加自动检查，确保 Windows 小尺寸图标存在安全留白、仍包含可见内容且资源更新后路径会变化。

### 目标用户

- 在 Windows 10/11 上使用 KnowMe 原生窗口的个人用户与团队用户。

### 验收标准

- Windows 标题栏图标四周具有可辨识的透明留白，不再贴边或呈现裁切感。
- Windows 任务栏在应用重启后使用本次更新的小尺寸图标，不再显示旧缓存中的铺满画布版本。
- Windows 系统托盘中的 KM 图标四周具有与相邻托盘图标一致的呼吸空间。
- 16 px 图标中的 KM 造型仍清晰可辨。
- 打包图标、任务栏图标和窗口图标继续使用有效的多尺寸 `.ico`。

### 非目标（Non-goals）

- 不调整窗口标题栏高度、标题文字间距或页面 CSS。
- 不重绘 KnowMe 品牌标志，不改变 64 px 及以上的主图标构图。
- 不改变非 Windows 平台的窗口图标行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `knowme-brand`: 补充 Windows 小尺寸窗口图标的安全留白与可辨识性要求。

## Impact

- 代码：`scripts/build-icon-refine.py`、`src/lib/app-icon.js`、`src/main.js`、品牌资源验证测试。
- 资源：`src/assets/icon.ico`。
- 系统：Windows 原生窗口标题栏、任务栏及打包图标选择。
- 依赖：沿用现有 Pillow 生成流程，不引入新依赖。
