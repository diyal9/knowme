# Code Review: launch-readiness-p0

## 摘要

P0 上线准备：移除硬编码、便签备份、安全设置、删除确认、关于/更新 UI。

## 审查项

- [x] 改动范围聚焦 P0，未引入过重依赖
- [x] IPC 经 preload 暴露，无 nodeIntegration
- [x] 备份格式含 MANIFEST 校验
- [x] 删除确认在主进程，防渲染层绕过
- [x] 测试覆盖 notes-backup

## 建议（非阻塞）

- main.js 仍较大，后续可拆模块
- safeStorage 不可用时的降级仍写明文 apiKey，文档已说明

## 结论

通过，可 story-done。
