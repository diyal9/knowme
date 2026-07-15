# 开发自测 — md-notebook-editor

日期：2026-07-14

## 自动化

| 检查 | 结果 |
|------|------|
| `npm test` | ✅ 78/78 通过 |
| `npm run lint` | ✅ pass |
| `harness gate --json` | ✅ 硬门禁通过（code-review 软项待后续） |

## 定位换血（代码审查）

- [x] `note.html` placeholder / title 已改为笔记文案
- [x] `list.html` / `memory.html` / `settings.html` 空状态与导入导出文案
- [x] `prompt-okf.js` 默认「未命名笔记」
- [x] `main.js` JumpList + 菜单「新建笔记」
- [x] `package.json` / `README.md` / `PRIVACY.md` 元数据
- [x] AI 优化菜单 data-p、main.js 内部 AI 指令未改
- [x] 知识库种子 `src/assets/knowledge-seed/` 未改

## MD 编辑器（静态审查）

- [x] 删除 sections-wrap UI，footer 改为编辑/预览
- [x] marked + DOMPurify vendor 于 `src/assets/vendor/`
- [x] `/` MD 斜杠菜单（`mdSlashMenu`，与 AI 技能 `/` 菜单 ID 分离）
- [x] Ctrl+B/I/K、智能回车、Tab 缩进 via execCommand
- [x] 选中气泡工具条（bold/italic/code/strike/link）
- [x] `ui-icons.js` 补 MD 图标

## 数据迁移

- [x] `migrateNoteFields`：structured/sections → content，editorMode='edit'
- [x] 单元测试 `migrateNoteFields merges structured sections into content`

## 待制作人/QA 手动验证

- 预览深浅色主题跟随
- 旧 structured 笔记真机打开内容完整
- `/` 菜单光标定位与滚动场景

---

## UI 回归修复（2026-07-14 晚）

**用户反馈**：footer 编辑/预览段控显示空白方块、收藏星标不可见、顶部 ghost 按钮图标缺失。

**根因**：
1. 模式按钮 `data-icon` 从已验证的 `note` 改为 `edit`，填充型 SVG 在 `.ico svg { stroke: currentColor }` 全局规则下部分环境渲染异常（path 有 fill 但视觉空白）。
2. `ui-icons.js` 放在 vendor 脚本之后加载，若 vendor 抛错会阻断图标挂载。
3. MD 斜杠菜单复用 `.slash-menu` / `.slash-item` 全局类名，与 AI 侧栏 `/` 菜单 CSS 冲突，间接影响布局观感。
4. `#mdSlashMenu` 同时带 `slash-menu` 类，触发 AI 菜单的 `position:absolute` 规则。

**修复**（`src/note.html`）：
- 编辑按钮恢复 `data-icon="note"`，预览保留 `eye`。
- `ui-icons.js` 移至 vendor 之前优先加载；`initNote` 回调末尾再次 `mountAllIcons()`。
- 为 `.mode-btn` / `.foot-star` / `.tool-ghost` 填充图标补 `path { fill: currentColor; stroke: none }`。
- MD 菜单 CSS 限定为 `.md-slash-menu`，DOM 移除多余 `slash-menu` 类。

**自测**：
| 检查 | 结果 |
|------|------|
| `npm test` | ✅ 78/78 |
| `npm run lint` | ✅ pass |
| MD 编辑/预览切换、`/` 菜单、气泡工具条 | 静态审查通过，待 `npm start` 目视确认 footer 图标 |
