# 知我 KnowMe 隐私说明

最后更新：2026-07-21

KnowMe 是一款**本地优先**的 AI 知识工作台。默认情况下，你的内容与设置保存在本机；我们不会运营云端账号或后台同步服务。

## 我们收集什么

**默认不上传以下内容：**

- 本地文件夹 / GitLab 工作副本中的文件正文
- 应用设置、Agent 会话
- API Key / GitLab Token（见下文）

## 数据存储位置

| 数据 | 默认路径（Windows） |
|------|---------------------|
| 应用数据 | `%APPDATA%\KnowMe\` |
| 内容源索引 | `%APPDATA%\KnowMe\sources.json` |
| GitLab 工作副本 | `%APPDATA%\KnowMe\repos\` |
| 正文内容 | 你绑定的本地目录，或上述 repos 克隆目录 |

macOS：`~/Library/Application Support/KnowMe/`。

> 旧版应用数据目录 **不会**被自动读取或迁移。

## API Key / Token

- AI API Key 与 GitLab Token 在系统加密可用时以 `safeStorage` 加密保存在本地。
- 调用 AI 或访问 GitLab 时，请求发往你配置的服务商 / 实例，不由 KnowMe 中转存储。

## 联系

项目仓库：[github.com/diyal9/knowme](https://github.com/diyal9/knowme)
