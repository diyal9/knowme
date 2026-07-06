# StickyNotes v0.1.1

首个可对外分发的正式 Release，面向 Windows 桌面用户。

## 亮点

- 多张无边框便签：自动保存、启动恢复、系统托盘
- 便签备份导入导出，降低迁移与误删风险
- 设置页手动「检查更新」，对接 GitHub Release
- 知识库 OKF 导入/导出（设置 → 知识库与记忆）
- API Key 本地加密存储（依赖系统 safeStorage）

## 下载与安装（Windows）

1. 在 [GitHub Releases](https://github.com/diyal9/sticky-notes/releases/tag/v0.1.1) 下载：
   - **安装版**：`StickyNotes-0.1.1-setup-win-x64.exe`（推荐）
   - **便携版**：`StickyNotes-0.1.1-portable-win-x64.exe`
2. 对照同目录 `SHA256SUMS.txt` 校验文件完整性（可选）。
3. 运行安装程序并按提示完成安装；便携版可直接运行 exe。

### 代码签名说明

<!-- CI 会在有证书时追加「已签名」说明；无证书时保留以下提示 -->

**本构建未进行代码签名。** Windows SmartScreen 或杀毒软件可能提示「未知发布者」。若你信任本开源仓库，可选择「仍要运行」或「更多信息 → 仍要运行」。我们计划在后续版本接入签名证书。

## 数据与隐私

- 便签默认保存在 `%APPDATA%\sticky-notes\notes\`
- 详见仓库 [PRIVACY.md](https://github.com/diyal9/sticky-notes/blob/main/PRIVACY.md)

## 已知限制

- Mac 版本为实验构建，需实机验收通过后才推荐下载；未签名/未公证时 Gatekeeper 可能阻止打开。
- 自动更新在 Mac 上可用性有限，建议 Windows 用户优先使用安装版 + 检查更新。
- 无云同步；换机请使用便签备份导出。

## 回滚

若本版本存在严重问题：

1. 在 Releases 页面下载上一可用版本，或等待维护者标记本 Release 为 pre-release。
2. 便签数据仍在 `%APPDATA%\sticky-notes\`，卸载应用不会自动删除；可先导出备份再操作。
3. 问题反馈请通过 GitHub Issues 提交。
