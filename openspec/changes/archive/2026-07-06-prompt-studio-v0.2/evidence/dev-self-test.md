# 开发自测: prompt-studio-v0.2

**日期**: 2026-07-06  
**版本**: 0.2.0

## 硬门禁

| 检查项 | 结果 |
|--------|------|
| `npm test` | PASS — 30/30 |
| `npm run lint` | PASS |

## 实现摘要

- 卡片 schema 扩展：`category`, `okfTags`, `okfConceptId`, `sections`, `editorMode`, `parentNoteId`
- `src/lib/prompt-sections.js` — 五段拼接/解析 + 迁移
- `src/lib/prompt-okf.js` — 收录/实例化 OKF Concept
- `src/lib/note-versions.js` + `note-diff.js` — 版本链与行级 diff
- `note.html` — 结构化/自由模式、分类、版本 modal、收录 OKF、AI 分类
- `list.html` — category/标签筛选、记忆入口
- `memory.html` — 使用记忆面板
- `main.js` — 新 IPC、托盘「使用记忆」、打开卡片 capture

## 待制作人/测试

- 按 `acceptance.md` 体验验收（结构化闭环、记忆跳转、OKF 双向）
- 按 `qa-plan.md` 填写 `test-report.md`
- Story 末：本地打包 + tag `v0.2.0`（须用户确认）
