# Tasks: md-notebook-editor

## 1. 定位换血

- [x] package.json description
- [x] README.md / PRIVACY.md
- [x] note.html / list.html / memory.html / settings.html 用户可见文案
- [x] prompt-okf.js 默认标题
- [x] main.js JumpList + 菜单「新建笔记」

## 2. 数据迁移

- [x] prompt-sections.js migrateNoteFields（structured→content，free→edit）
- [x] main.js 默认 editorMode、note-update 去掉 structured 分支
- [x] 同步 sticky-notes-v02.test.js 迁移测试

## 3. MD 编辑器

- [x] vendor：marked + DOMPurify
- [x] note.html：删除 sections-wrap；编辑/预览切换
- [x] `/` 斜杠菜单 + 快捷键 + 气泡工具条
- [x] ui-icons.js 补 MD 图标

## 4. 自测

- [x] npm test && npm run lint
- [x] note-polish.test.js 断言同步
- [x] evidence/dev-self-test.md
