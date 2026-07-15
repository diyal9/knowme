# QA Plan: md-notebook-editor

## Smoke Scope

- [ ] 新建笔记：placeholder 为「笔记标题」「支持 Markdown」
- [ ] 编辑/预览切换：预览正确渲染标题、列表、代码块
- [ ] `/` 菜单：输入 `/` 弹出，Enter 插入标题/列表
- [ ] 快捷键 Ctrl+B 加粗选中文字
- [ ] 选中文字出现气泡工具条
- [ ] 旧 structured 笔记打开后内容完整、无分段 UI
- [ ] 列表页空状态文案「还没有笔记」
- [ ] 设置页「导出/导入全部笔记 JSON」

## 反模式

- [ ] 预览态 XSS：`<script>` 被 DOMPurify 剥离
- [ ] 编辑态 Ctrl+Z 可撤销 insertText 插入

## 自动化

- `npm test`
- `npm run lint`
