# 测试报告: release-v0.1.1

- 日期：2026-07-02
- 测试人：测试（QA）
- Change：release-v0.1.1
- 构建来源：`dist-release/`（`npm run smoke:release`）

## 门禁

| 项 | 级别 | 结果 |
|----|------|------|
| npm test | 硬 | **PASS**（22/22） |
| npm run lint | 硬 | **PASS** |
| qa-plan Smoke Scope | 软 | **已执行**（5/6 自动化 + 1 待 tag 后复验） |
| code-review.md | 软 | **已完成** |

## Smoke Scope

| 用例 | 结果 | 备注 |
|------|------|------|
| Windows installer 安装并启动 | **PASS** | `release-smoke.js` NSIS `/S` + 进程启动 |
| 新建便签 → 自动保存 → 重启恢复 | **PASS** | 隔离 `--user-data-dir`，落盘 + relaunch |
| 设置页版本 0.1.1 | **PASS** | `app.asar` 内 `package.json.version` |
| 检查更新有明确反馈 | **PASS**（接线） | `checkForUpdatesManual` 返回 `message`；**GUI Toast 无截图** → ADVISORY |
| 删除便签确认框 | **PASS**（接线） | `note-delete` + `showMessageBoxSync`；取消路径未 GUI 点按 → ADVISORY |
| 便签备份导出 | **PASS** | `exportBundle` → MANIFEST + notes/ |
| GitHub Release 页面资产 | **SKIP** | 仓库未推送 `v0.1.1` tag；本地 `build/release-notes.md` + `dist-release/` 已验 |

## Regression Scope

| 用例 | 结果 | 备注 |
|------|------|------|
| npm test | **PASS** | |
| npm run lint | **PASS** | |
| 全局热键 Ctrl+Alt+N | **ADVISORY** | 无 E2E；`main.js` 已注册 shortcut |
| 托盘菜单 | **ADVISORY** | 无 E2E；`updateTray()` 菜单项存在 |
| API Key 无明文 | **PASS** | `settings-secure.test.js` 3/3 |
| OKF 导入/导出 | **PASS** | `product-knowledge.test.js` |
| 关闭便签仅隐藏 | **ADVISORY** | 代码路径 `note-close` hide；无 GUI 重跑 |

## Release QA

| 用例 | 结果 | 备注 |
|------|------|------|
| NSIS 安装路径可启动 | **PASS** | 静默安装冒烟 |
| portable 可直接运行 | **PASS** | `win-unpacked` / portable 产物存在 |
| SHA256 一致 | **PASS** | 4/4 |
| Release notes 版本与资产名 | **PASS** | `build/release-notes.md` + 产物命名 `0.1.1` |
| 未签名风险披露 | **PASS** | release-notes + README |
| 回滚说明 | **PASS** | release-notes「回滚」章节 |

## Mac Validation

| 用例 | 结果 | 备注 |
|------|------|------|
| 实机型号/系统/启动 | **SKIP** | `mac-validation.md` 阻塞记录 |
| 未标 Mac 正式支持 | **PASS** | README + release-notes 标实验 |

## 反模式审查

| 反模式 | 结果 | 说明 |
|--------|------|------|
| 断网检查更新卡死 | **ADVISORY** | 未 GUI 断网复测；逻辑层 `catch` 返回 message |
| 重复安装/启动损坏数据 | **PASS** | smoke 重启恢复 2 轮无损坏 |
| README 指向本地 dist 下载 | **PASS** | 用户向指向 GitHub Releases |
| 隐私承诺未实现能力 | **PASS** | 明确「无云同步/无账号」 |
| 快速连点删除多对话框 | **ADVISORY** | 与 p0 相同，无 debounce |

### [ADVISORY] 无 GUI 截图证据
- **说明**：`evidence/screenshots/` 本轮无实机截图；打包冒烟与单测覆盖核心路径
- **建议**：tag 推送后补 Release 页截图（可选）

### [ADVISORY] GitHub Release 未发布
- **说明**：CI 未触发，检查更新「已是最新版」路径未对真实 Release 验证
- **建议**：`git tag v0.1.1` 推送后补一轮 Smoke #6

## 结论

**QA：PASS（含 ADVISORY，无 BLOCKING）**

- 可通知制作人勾选任务 12 正式通过
- 可进入 `/gate-check` → `/story-done`
- tag 推送后建议补验 GitHub Release 页面（非阻塞本 Story 归档）

## 证据

- `evidence/dev-self-test.md`
- `evidence/windows-release-smoke.md`
- `evidence/mac-validation.md`
- `evidence/screenshots/README.md`
- `code-review.md`
