## Context

基线 `f6ad048`：`openDrawer('设置', { kind: 'settings', center: true })` + `settings.html?embedded=1`。现行已有 `SettingsSurface` 组件与 `openSettings()`（发 `workspace-open-settings` 并关掉独立窗），缺主区挂载。

## Goals / Non-Goals

- Goals: 主窗口内设置；rail 不再 `openSettingsWindow`
- Non-Goals: 重做设置信息架构；取消独立窗兜底

## Decisions

- 增加 `AppRoute = 'settings'`，主区直接渲染 `SettingsSurface embedded`，不 iframe
- 嵌入态 footer 用 sticky，避免 `position:fixed` 盖住整个工作台
- 文件栏走 `openSettings('sources')`，由主进程通知工作台

## Risks

- 独立窗与主区两套实例：主进程在工作台存在时关闭独立窗
