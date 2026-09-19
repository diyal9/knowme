# 知我 KnowMe — AI 知识工作台

本地私有的 **AI 工作伙伴 Agent**：内容来自你绑定的**本地文件夹**或 **GitLab** 仓库；应用目录只保存会话、设置与索引。

## 下载与安装

**推荐从 GitHub Release 获取安装包**：

| 平台 | 状态 | 下载 |
|------|------|------|
| Windows x64 | **正式支持** | [Releases](https://github.com/diyal9/knowme/releases/latest) |
| macOS | 实验构建 | 同上 |

### Windows 安装步骤

1. 下载 `KnowMe-<version>-setup-win-x64.exe`（安装版）或 `KnowMe-<version>-portable-win-x64.exe`（便携版）。
2. （可选）用 Release 附带的 `SHA256SUMS.txt` 校验安装包哈希。
3. 运行安装程序；便携版解压后直接运行 exe。
4. 首次启动后可在系统托盘找到 **KnowMe**；打开设置 → **内容源** 添加本地文件夹或 GitLab 项目。

> **数据目录**：KnowMe 使用 `%APPDATA%\KnowMe\`，**不会自动迁移**旧版应用数据。旧版数据目录可手动删除。

## 数据存储

| 数据 | 路径（Windows） |
|------|-----------------|
| 应用设置 / 会话 | `%APPDATA%\KnowMe\` |
| 内容源索引 | `%APPDATA%\KnowMe\sources.json` |
| GitLab 工作副本 | `%APPDATA%\KnowMe\repos\` |
| 正文内容 | 你绑定的本地文件夹，或 GitLab 克隆目录 |

## 开发

```bash
git clone https://github.com/diyal9/knowme.git
cd knowme
npm install
npm start
```

```bash
npm test
npm run lint
npm run build:win
```

完整开发检查：`npm run check`。其中图片布局回归使用真实 Chromium（不仅是 jsdom），首次运行前需安装测试浏览器：

```bash
npx playwright install chromium
npm run check
```

Linux CI 若缺浏览器系统依赖，可使用 `npx playwright install --with-deps chromium`。测试不会自动下载浏览器或静默跳过布局断言；这些依赖仅用于开发测试，不影响应用安装包。

## 许可证

MIT
