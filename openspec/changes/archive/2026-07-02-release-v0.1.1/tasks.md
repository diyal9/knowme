# Tasks: release-v0.1.1

- [x] 1. 确认 `v0.1.1` 发布范围与版本号策略（package/electron-builder/Release notes 一致）
- [x] 2. 补充 `LICENSE`，明确 StickyNotes 的分发与使用条款
- [x] 3. 补充隐私政策，覆盖本地便签、知识库/记忆、API Key、备份导入导出与默认无云同步
- [x] 4. 更新 README：下载入口、安装说明、数据路径、备份恢复、未签名提示、Mac 支持状态
- [x] 5. 完善 Release workflow：tag 触发 test、lint、build、打包、上传 Release assets
- [x] 6. 增加/校验 Windows Release assets：installer、portable 或 zip、SHA256 校验文件
- [x] 7. 配置代码签名边界：使用 GitHub Secrets/环境变量；无证书时构建不失败且 Release notes 明示
- [x] 8. 准备 `v0.1.1` Release notes 模板：亮点、安装、校验、已知限制、回滚方式
- [x] 9. 执行 Windows 发布冒烟：下载资产、安装/启动、新建便签、自动保存、重启恢复、检查更新（见 `evidence/windows-release-smoke.md`，11/11 PASS）
- [x] 10. 执行 Mac 实机验收或记录阻塞：机型、macOS、资产、启动结果、截图/日志（见 `evidence/mac-validation.md`，已记阻塞）
- [x] 11. 填写开发自测证据：`evidence/dev-self-test.md`，包含 test/lint/build/Release workflow 结果
- [x] 12. 制作人按 `acceptance.md` 体验验收，通过后交给测试接入（QA test-report PASS）
- [x] 13. 修复 safeStorage 不可用时的 API Key 降级：禁止明文持久化，Toast 提示用户
