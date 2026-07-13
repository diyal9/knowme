# Sticky-Notes v0.3.0

总览重构：按主题管理提示词库。

## 亮点

- **主题侧栏**：全部 / 收藏 / 各 category / 未分类，带计数一键筛选
- **行内核心标签**：展示 `okfTags`（回退 `tags`）与分类徽章
- **紧凑列表**：单行预览，路径降为 tooltip，减少视觉噪音
- 继承 v0.2：结构化编辑、版本链、记忆面板、OKF 双向

## 下载与安装（Windows）

1. 在 [GitHub Releases](https://github.com/diyal9/sticky-notes/releases) 下载 `0.3.0` 安装版或便携版。
2. 对照 `SHA256SUMS.txt` 校验（可选）。
3. 数据仍在 `%APPDATA%\sticky-notes\`，旧版卡片自动兼容。

### 代码签名说明

**本构建可能未进行代码签名。** SmartScreen 可能提示「未知发布者」——请从官方 Release 页下载并校验 SHA256。

## 已知限制

- Mac 仍为实验构建；自动更新在 Mac 上可用性有限。
- 无云同步；换机请使用便签备份与 OKF 导出。
- 未填写 category 的卡片归入「未分类」。

## 回滚

卸载后安装上一版本即可；用户数据目录不变。
