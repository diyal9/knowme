# Proposal: md-notebook-editor

## 一句话目标

将 StickyNotes 从「提示词工作台」重定位为「AI 驱动的 Markdown 笔记本」，并用现代 MD 编辑/预览模式替换分段编辑。

## 目标用户

需要本地私有笔记 + AI 助写 + 提示词优化能力的桌面用户。

## 为什么做

- 产品定位需从单一提示词工具扩展为 Markdown 笔记本
- 分段模式（角色/任务/…）对通用笔记场景过重；MD 编辑/预览 + `/` 命令更符合现代 AI 编辑器体验

## 做什么

1. **定位换血**：用户可见文案与 package/README/PRIVACY 元数据（保留 AI 提示词优化功能与内部指令）
2. **MD 编辑模式**：编辑/预览两态；marked + DOMPurify 预览；`/` 斜杠菜单；快捷键与选中气泡工具条
3. **数据迁移**：旧 `structured`/`sections` 打开时合并为 `content` Markdown，`editorMode` 语义改为 `'edit'|'preview'`

## 非目标

- 不引入 WYSIWYG 重量级编辑器
- 不改 openspec/archive、brain、知识库种子
- 不改 AI 菜单「优化/扩展/精简/翻译」按钮及其 data-p

## 验收标准

- 文案与 README 反映「Markdown 笔记本」定位
- 编辑/预览切换正常；`/ ` 菜单与快捷键、气泡工具条可用
- 旧分段笔记打开后内容不丢失
- `npm test` / `npm run lint` 通过
