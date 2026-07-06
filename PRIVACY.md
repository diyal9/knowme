# StickyNotes 隐私说明

最后更新：2026-07-02 · 适用版本：v0.1.1 及之后

StickyNotes 是一款**本地优先**的桌面便签应用。默认情况下，你的便签与知识库数据保存在本机，我们不会运营云端账号或后台同步服务。

## 我们收集什么

**默认不上传以下内容：**

- 便签正文、标题、位置与窗口状态
- 产品知识库（OKF）与使用记忆
- API Key（见下文「API Key 处理」）

应用**不会**在后台把便签内容批量上传到我们的服务器。

## 数据存储位置

| 数据 | 默认路径（Windows） |
|------|---------------------|
| 便签卡片 | `%APPDATA%\sticky-notes\notes\` |
| 应用设置 | `%APPDATA%\sticky-notes\settings.json` |
| 产品知识库（OKF） | `%APPDATA%\sticky-notes\knowledge\` |
| 产品使用记忆 | `%APPDATA%\sticky-notes\memory\` |

macOS 路径位于 `~/Library/Application Support/sticky-notes/` 下同名子目录。

## 备份与导入导出

- **便签备份**：设置页可导出便签到自选文件夹（含 manifest 与 notes 数据），用于迁移或手动备份。
- **知识库 OKF 包**：设置页可导入/导出 OKF 知识库包，操作仅在本地读写文件。
- 备份文件由你自行保管；我们不会自动读取你导出的备份。

## API Key 处理

若你配置 AI 相关功能并填写 API Key：

- 在支持的操作系统加密能力（Electron `safeStorage`）可用时，Key 以加密形式保存在 `settings.json` 中，不以明文写入。
- 若系统加密不可用，应用**不会**把 API Key 以明文持久化，并会提示你无法安全保存。
- 调用 AI 接口时，请求会按你填写的 Endpoint 发往对应服务商（如 OpenAI 兼容 API）；该传输由你与服务商之间的网络完成，不由 StickyNotes 中转存储。

## 自动更新

正式安装版可从 GitHub Release 检查更新。该过程会访问 GitHub 获取版本元数据与安装包信息，**不会**上传便签内容。

## 我们不提供的能力（当前版本）

- 无用户账号体系
- 无官方云同步或云备份
- 无默认遥测或行为分析上报

## 联系与变更

隐私政策可能随版本更新；重大变更会在 Release notes 或本文件中说明。

项目仓库：[github.com/diyal9/sticky-notes](https://github.com/diyal9/sticky-notes)
