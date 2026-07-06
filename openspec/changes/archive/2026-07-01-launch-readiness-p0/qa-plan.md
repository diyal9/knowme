# QA Plan: launch-readiness-p0

## Smoke Scope（必填）

- [x] 打包版 `dist/win-unpacked/StickyNotes.exe` 启动无 JS 错误弹窗
- [x] 设置页显示版本号；点击「检查更新」有反馈（无网络时提示错误即可）
- [x] 导出便签备份 → 选择空文件夹 → Toast 成功 → 目录含 notes/*.json + MANIFEST.json
- [x] 导入便签备份 → 便签出现在总览列表
- [x] 删除便签 → 确认框 → 取消保留 / 确认删除
- [x] 保存 API Key 后 settings.json 无明文字段 `apiKey`

## Regression Scope

- [ ] 新建便签、自动保存、重启恢复
- [ ] 知识库 OKF 导入导出仍正常
- [ ] 托盘菜单、热键 Ctrl+Alt+N/L

## Anti-pattern Checks

- [ ] 快速连点删除 → 不应重复弹多个确认导致崩溃
- [ ] 导入空/无效文件夹 → 明确错误 Toast
- [ ] 输入中途关闭设置 → 未保存项行为符合预期
