# QA Plan: fix-windows-titlebar-icon-safe-area

## Smoke Scope（必填）

- [x] Windows 标题栏图标四周具有可辨识透明留白，KM 造型清晰
- [x] 16/24/32/48 px `.ico` 帧经自动化验证 12.5% 安全区
- [x] 64/128/256 px 帧保持完整画布构图不变
- [x] 内容寻址 `app-icon-<digest>.ico` 在图标更新后路径变化
- [x] 系统托盘 `tray-icon.png` 具备相同安全留白
- [x] 应用重启后任务栏/托盘使用新图标，无旧缓存铺满感

## Regression Scope

- [x] `npm test` 全量通过（含 brand-icon-safe-area、app-icon-cache）
- [x] `npm run lint` 与 `npm run prebuild` 通过
- [x] 非 Windows 平台窗口图标行为未改变
- [x] 左 Rail 与工作台 UI 无回归

## Anti-pattern Checks

- 小尺寸 KM 贴边或被裁切感
- 任务栏继续显示旧路径缓存的铺满图标
- 托盘图标占满槽位、与相邻图标视觉不一致
- 运行时主进程生成图标导致启动变慢
