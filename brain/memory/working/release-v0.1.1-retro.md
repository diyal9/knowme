# Retro: release-v0.1.1

## 完成内容

- 首版正式发布闭环：LICENSE、PRIVACY.md、README 下载说明
- GitHub Release workflow（test → lint → 矩阵打包）
- SHA256SUMS、release-notes 模板、未签名披露
- `scripts/release-smoke.js` 隔离 user-data-dir 打包冒烟（11/11）
- safeStorage 不可用时禁止 API Key 明文 + Toast
- 版本 0.1.1

## 经验

- 本地 `dist/` 被占用时，用 `-c.directories.output=dist-release` 绕过文件锁
- 编辑 `package.json` scripts 时勿误删 `test` 脚本（会导致 gate 失败）
- Mac 无实机可记阻塞并标实验，不阻塞 Windows 发布 Story
- GUI 截图缺失可用自动化冒烟 + 单测结案，ADVISORY 记入 test-report

## 待跟进（非本 Story）

- `git tag v0.1.1` 推送 → GitHub Release 实页验证
- Mac 实机验收
- 代码签名证书
- E2E 覆盖检查更新 Toast、托盘热键
