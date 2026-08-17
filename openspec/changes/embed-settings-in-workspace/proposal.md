## Why

重构前点侧栏「设置」在主窗口中间区打开（`openSettingsPanel` + embedded iframe），注释写明「而不是二级独立窗口」。现行 React 侧栏调用 `openSettingsWindow`，弹出系统级 BrowserWindow。

## What Changes

- 侧栏 / 文件栏「添加内容源」在主窗口打开 `SettingsSurface`
- 已打开时再点设置则关闭（回到助理），对齐基线 toggle
- 托盘 `openSettings` 的 `workspace-open-settings` 接到 React 壳
- 独立设置窗仅作工作台未打开时的兜底

## Capabilities

### New Capabilities

- `workspace-settings-surface`: 设置在工作台主区展示

### Modified Capabilities

- （无）

## Impact

- `src/domain/rail.ts`、`SideRail`、`AppShell`、`FilesPane`、`SettingsSurface` CSS
- 独立 Vite `settings` 入口保留

## 非目标

- 不删除 `openSettingsWindow` IPC
- 不改设置各 Tab 表单字段
