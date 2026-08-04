# Spec: knowme-brand

## 显示名
- WHEN 应用启动 THEN 托盘 tooltip、主窗口标题、设置/记忆等窗口品牌文案 SHALL 使用 `KnowMe`（中文场景可并列「知我」）
- WHEN 打包 Windows 安装包 THEN `productName` / 快捷方式名 SHALL 为 `KnowMe`

## 数据目录
- WHEN 首次启动 KnowMe THEN `userData` SHALL 指向 `%APPDATA%\KnowMe\`（或 Electron 等价路径）
- AND 应用 MUST NOT 自动迁移或读取旧版应用数据目录

## 文案
- WHEN AI 默认系统提示词提及产品名 THEN SHALL 使用 KnowMe / 知我
- AND 仓库源码与文档 MUST NOT 再出现旧品牌字面量或旧路径 slug
