# Code Review: release-v0.1.1

## 审查范围

| 区域 | 文件 |
|------|------|
| 版本与许可 | `package.json`, `LICENSE` |
| 用户文档 | `README.md`, `PRIVACY.md`, `build/release-notes.md` |
| 打包与 CI | `electron-builder.yml`, `.github/workflows/release.yml`, `scripts/checksums.js` |
| 安全 | `src/lib/settings-secure.js`, `src/main.js`, `src/preload.js`, `src/settings.html` |
| 测试 | `tests/settings-secure.test.js`, `tests/smoke.test.js` |

## 检查项

- [x] 符合 OpenSpec `specs/release-v0.1.1.md`（文档、Release 流程、签名边界、隐私、更新检查接线）
- [x] 无便签体验等非目标 scope 改动
- [x] `save-settings` 改 `invoke`，preload 仍经 `contextBridge`
- [x] safeStorage 不可用时禁止 API Key 明文落盘，UI Toast 反馈
- [x] 证书仅经环境变量/Secrets，未入库
- [x] Release workflow 先 test/lint 再矩阵打包
- [x] 单元测试覆盖 settings-secure 三条路径

## 建议（非阻塞）

- Mac 实机验收仍阻塞，Release notes/README 已标实验状态，符合 design
- 本地 `dist/` 文件锁导致开发机 build 失败，不影响 CI；冒烟应在 Release 资产上补证据
- `checksums.js` 在 `afterAllArtifactBuild` 生成，需实机确认 SHA256SUMS 随 publish 上传

## 结论

- [x] **已完成** — 代码与文档实现符合本 Story 范围，硬门禁 test/lint 通过
- 审查人：开发（自审）
- 日期：2026-07-02
- 备注：制作人验收与 Windows 发布冒烟待 Release 资产或清锁后本地包完成
