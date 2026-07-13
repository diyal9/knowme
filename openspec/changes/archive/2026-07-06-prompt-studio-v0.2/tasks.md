# Tasks: prompt-studio-v0.2

## P0 — 数据与迁移

- [x] 1. 扩展卡片 schema：`category`, `okfTags`, `okfConceptId`, `sections`, `editorMode`, `parentNoteId`；`loadAllNotes` 补默认值
- [x] 2. 实现 `sections` ↔ `content` 拼接/解析工具 `src/lib/prompt-sections.js` + 单元测试
- [x] 3. 扩展 `saveNote` / IPC 透传新字段，保证旧卡片读写无回归

## P0 — 结构化编辑器

- [x] 4. `note.html`：结构化五段表单 + 自由模式切换 UI
- [x] 5. 等宽字体、字数/Token 粗估显示
- [x] 6. 保存时统一生成 `content`；切换模式不丢数据

## P0 — 版本链与 diff

- [x] 7. 扩展 `new-version` IPC：写入 `parentNoteId`，继承 project/category/sections
- [x] 8. 新增 `get-note-versions`、`get-note-diff` IPC + 简单行级 diff
- [x] 9. 卡片 UI：版本历史列表 + diff 查看（modal 或侧栏）

## P0 — 总览分类

- [x] 10. `list.html`：category / okfTags / 项目 / 收藏筛选器
- [x] 11. 卡片编辑区或总览：设置 category、okfTags（手动输入或选择）
- [x] 12. 总览列表展示 category 标签与版本组提示

## P0 — 记忆面板

- [x] 13. 新增 `memory.html` + `open-memory-panel` IPC
- [x] 14. `memory-recent` IPC：读 `product-memory.js` 近期记录
- [x] 15. 记忆条目点击跳转对应 `noteId` 卡片
- [x] 16. 托盘/总览入口：「使用记忆」

## P0 — OKF 双向

- [x] 17. 新建 `src/lib/prompt-okf.js`：卡片 → Concept（promote）
- [x] 18. Concept → 卡片（instantiate）；关联 `okfConceptId`
- [x] 19. 卡片菜单/按钮：「收录到知识库」「从知识库实例化」
- [x] 20. promote 后 OKF lint 通过；设置页统计与总览一致

## P0 — 产品叙事与版本

- [x] 21. README、托盘、list/note 标题文案改为 Sticky-Notes 定位
- [x] 22. `package.json` → `0.2.0`；`build/release-notes.md` v0.2.0 亮点
- [x] 23. 关于/设置页版本号显示 `0.2.0`

## P1 — AI 分类建议

- [x] 24. `suggest-classification` IPC：调用现有 AI API 返回 category/tags
- [x] 25. UI：「AI 建议分类」按钮 + 确认后写入；无 Key 时友好跳过

## P0 — 测试与证据

- [x] 26. 单元测试：`prompt-sections`、`prompt-okf` roundtrip、迁移默认值
- [x] 27. 扩展 `smoke.test.js`：新 IPC 接线、schema 字段存在
- [x] 28. `evidence/dev-self-test.md`：test/lint/本地启动自测
- [x] 29. 制作人按 `acceptance.md` 体验验收
- [x] 30. 测试按 `qa-plan.md` 执行并填写 `evidence/test-report.md`

## P0 — 发布（Story 末）

- [x] 31. 本地 `npm run build` 或 `dist-release` 打包验证
- [ ] 32. commit + tag `v0.2.0` + push 触发 Release workflow（用户确认后）
