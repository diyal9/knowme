# Acceptance: md-notebook-editor

## 产品定位

- [x] 用户感知为「Markdown 笔记本」而非「提示词工作台」
- [x] AI 提示词优化能力仍可从 AI 侧栏快捷菜单使用

## 编辑器

- [x] 编辑/预览切换流畅，预览样式与主题一致（静态审查 + 测试套件）
- [x] `/` 命令菜单可插入标题、列表、代码块等
- [x] 快捷键与选中气泡可用（P1 冲突已修复，见复验说明）
- [x] 旧分段笔记迁移后内容不丢（单元测试覆盖）

## 骨架回归

- [x] 标题区、主题/标签、收入库/智能分类 intact
- [x] footer 收藏 / 保存状态 / AI 助写 / 复制 intact（图标回归修复已合入，待 QA 目视）
- [x] 分段 UI 已移除（`.sections-wrap { display:none }`）

## 门禁

- [x] npm test / lint 通过（开发自测）

## 验收结论

- [x] **通过** — P1 已消除，骨架 intact，放行测试 QA
- [ ] 不通过（BLOCK）

## 问题清单

| 级别 | 问题 | 说明 |
|------|------|------|
| ~~P1~~ | ~~Ctrl+K 双绑~~ | ✅ 已修复：`document` 监听在 `e.target===editor && viewMode==='edit'` 时跳过 |
| ~~P1~~ | ~~Tab 双重监听~~ | ✅ 已修复：第二处 `keydown` 开头 `if (e.defaultPrevented) return` |
| P2 | footer 图标 | 回归修复仅静态审查通过，需 QA 真机确认 mode-btn / foot-star / tool-ghost 渲染 |
| P3 | 文案混用 | README 部分仍写「便签」，与「笔记」主叙事略不一致（非阻塞） |
| P3 | 记忆摘要 | `main.js` 内部记忆写入仍用「打开/复制提示词」（用户不可见） |

## 最小修复建议

1. **Ctrl+K**：在 `document` 级监听中，当 `e.target === editor` 且 `viewMode === 'edit'` 时跳过 AI 快捷；或 MD 链接改绑 `Ctrl+Shift+K` 并更新 spec。
2. **Tab**：删除第二处 `editor` keydown 中的 Tab 分支（约 L1491），或在开头加 `if (e.defaultPrevented) return`，避免覆盖 `handleListTab`。

## 复验说明（2026-07-14 晚）

| 项 | 结论 |
|----|------|
| Ctrl+K | 编辑区仅触发 MD 链接包裹；全局 AI 快捷在非编辑焦点时仍可用 |
| Tab | 列表行由 `handleListTab` 独占；普通行仍走 2 空格插入 |
| UI 骨架 | 顶栏/标题·主题·标签/收入库·智能分类/footer 收藏·保存·AI·复制/AI 侧栏均未改动结构 |
| 门禁 | `npm test` 78/78、`npm run lint` pass |

## 是否可进入测试 QA

**是** — 制作人复验 PASS，测试可按 `qa-plan.md` 接入。

- 验收人：制作人
- 日期：2026-07-14（复验）
