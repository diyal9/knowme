# 开发自测报告

- 日期：2026-07-02
- Change：release-v0.1.1
- npm test: **PASS**（22/22）
- npm run lint: **PASS**
- npm run build:win: **PASS**（`dist-release/`，原 `dist/` 占用时用 `-c.directories.output=dist-release`）
- release-smoke: **PASS**（11/11，`node scripts/release-smoke.js dist-release`）
- Release workflow: `.github/workflows/release.yml`（test → lint → 矩阵打包发布）

## 实现项

- [x] 版本号 `0.1.1`、`LICENSE`、`PRIVACY.md`、README、Release workflow
- [x] SHA256SUMS、签名边界、release-notes 模板
- [x] safeStorage 降级 + 单元测试
- [x] `code-review.md`
- [x] Windows 发布冒烟（任务 9）

## Windows 构建产物

| 文件 | 校验 |
|------|------|
| `StickyNotes-0.1.1-setup-win-x64.exe` | SHA256 OK |
| `StickyNotes-0.1.1-portable-win-x64.exe` | SHA256 OK |
| `app.asar` 内 version | 0.1.1 |

## 交互冒烟摘要

- NSIS 静默安装可启动
- 便签创建 → 落盘 → 重启恢复
- 备份导出结构正确
- 删除确认、检查更新：主进程/模块接线已验证（UI 点按留 QA）

## 备注

- Mac 实机：`mac-validation.md` 阻塞（任务 10 已记录，不阻塞 Windows 发布）
- GitHub Release `v0.1.1` 待 tag 推送后由 CI 上传
