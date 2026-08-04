# Spec: doc-chrome

> 工作台 `editor-pane` 文档区 Chrome。遗留浮窗 `note.html` 仍遵循 `footer-toolbar` spec。

## 头栏右侧

- WHEN 用户打开文件 THEN 文档头标题行右侧 MUST 仅常驻「阅读视图」与「更多」两个图标按钮
- AND MUST NOT 在标题行常驻展示版本对比、最终提示词等次要入口

## 阅读视图

- WHEN 用户点击阅读视图按钮且当前为 MD 源码 THEN 切换为预览（阅读）模式
- WHEN 用户再次点击 THEN 回到 MD 源码编辑
- WHEN 当前为纯文本 THEN 先进入 MD 再打开阅读视图

## 更多菜单

- WHEN 用户点击更多 THEN 展开下拉菜单，至少包含：阅读视图、源码模式、文本模式、版本对比、最终提示词预览、收藏
- AND 选中项后菜单关闭并执行对应动作

## AI 助写入口

- WHEN 用户需要 AI 助写 THEN 从工作台最左侧 ribbon 点击 AI 入口打开/关闭
- AND 文档底栏 MUST NOT 再展示「AI 助写」按钮

## 复制

- THEN 文档编辑器 UI MUST NOT 展示「复制」按钮与「已复制 N×」文案
- AND 数据字段 `copyCount` 可保留（兼容列表排序等）

## 底栏状态条

- THEN 底栏 MUST 展示：收藏星、相对保存时间、词数、字符数、token 估算（有内容时）
- AND MUST NOT 在底栏放置模式切换分段、预览图标工具组、AI/复制操作区

## 来源

Synced from `openspec/changes/archive/2026-07-16-obsidian-doc-chrome/specs/doc-chrome.md`
