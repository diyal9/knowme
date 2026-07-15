# Spec: md-notebook-editor

## 产品定位

StickyNotes 是 **AI 驱动的本地 Markdown 笔记本**。Markdown 为核心文档格式；内置版本迭代、OKF 知识库、AI 助写；提示词优化是其中一项能力。

## 编辑模式

- Footer 提供「编辑 / 预览」两态，默认编辑
- 编辑：textarea 纯 MD 源码
- 预览：marked 渲染 + DOMPurify.sanitize

## 斜杠命令

空行或行首 `/` 触发浮层菜单，支持模糊过滤与 ↑↓/Enter/Esc。

## 快捷键

Ctrl+B/I/K；列表智能回车；Tab/Shift+Tab 缩进。

## 选中气泡

编辑态选区上方浮出 bold/italic/code/strike/link 工具条。

## 迁移

`editorMode==='structured'` 或存在 sections → 合并到 content，editorMode='edit'。
