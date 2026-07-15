# 测试报告: md-notebook-editor

**日期**: 2026-07-14  
**测试人**: Tester（QA 接入门禁）  
**前置**: 开发自测 PASS + 制作人验收 PASS（见 `acceptance.md`）

## 门禁

- [硬] npm test: **PASS** (78/78)
- [硬] npm run lint: **PASS**
- [硬] harness gate: **PASS**
- [软] qa-plan Smoke Scope: **已执行**
- [软] code-review: **已完成**

## Smoke 结果（qa-plan.md）

| 用例 | 结果 | 验证方式 | 备注 |
|------|------|----------|------|
| 新建笔记 placeholder | PASS | 静态 | 标题 `笔记标题…`；正文含 `支持 Markdown` |
| 编辑/预览切换 | PASS | 静态 + 浏览器 harness | marked 渲染 h2/列表/代码块；DOMPurify 净化 |
| `/` 菜单插入 | PASS | 静态 + harness | 行首 `/` 正则触发；Enter/点击插入逻辑存在 |
| Ctrl+B 加粗 | PASS | 静态 | `applyMdAction('bold')` 绑定 Ctrl+B |
| 选中气泡工具条 | PASS | 静态 | `#selBubble` + bold/italic/code/strike/link |
| 旧 structured 笔记迁移 | PASS | 单元测试 | `migrateNoteFields merges structured sections into content` |
| 列表空状态「还没有笔记」 | PASS | 静态 | `list.html` 含 `还没有笔记，点右下角新建` |
| 设置页导出/导入 JSON | PASS | 静态 | `settings.html` 含 `导出/导入全部笔记 JSON` |

## 回归风险（骨架）

| 项 | 结果 | 说明 |
|----|------|------|
| footer 编辑/预览/收藏/保存 | PASS | `mode-seg` / `foot-star` / `footer-meta` 结构 intact；图标 SVG 挂载 harness 通过 |
| AI 助写入口 | PASS | `aiToggle` 仍在 footer 行；Ctrl+K 编辑区让位逻辑已合入 |
| 复制 / 收藏 | PASS | `favorite-to-footer` 测试 + `btnCopy`/`toggleFavorite` 接线保留 |
| 分段 UI 移除 | PASS | `.sections-wrap { display:none !important }` |
| 顶栏主题/标签/收入库/智能分类 | PASS | 结构与事件监听未改动 |

## 反模式检查

| 反模式 | 结果 | 说明 |
|--------|------|------|
| 预览 XSS `<script>` | PASS | DOMPurify 剥离 script/onerror（浏览器 harness） |
| 编辑态 Ctrl+Z 撤销 insertText | PASS | `execCommand('undo')` 可恢复（浏览器 harness） |
| Ctrl+K 快捷键冲突 | PASS | `document` 监听在 `editor && viewMode==='edit'` 时跳过 AI 快捷 |
| Tab 双重监听 | PASS | 第二处 keydown `if (e.defaultPrevented) return` |
| 快速连点 / 空保存 | PASS（静态） | `schedSave` 防抖 700ms；空内容不触发复制 |
| 认知负担 / 可发现性 | PASS（静态） | 编辑/预览 footer 分段；AI 按钮带「AI 助写」文案 |

## 反模式发现

### [ADVISORY] Electron 真机 UI 截图未采集
- **反模式**：本次 QA 未在 Electron 窗口内完成目视截图
- **预期**：`evidence/screenshots/` 含 footer 图标、编辑/预览态截图
- **实际**：浏览器 harness 验证图标 SVG 挂载与预览链路；目录已建但无 PNG
- **证据**：`evidence/qa-harness.html` + harness 控制台结果（见下）

### [ADVISORY] placeholder 与 qa-plan 字面略有差异
- **反模式**：对照 qa-plan 精确文案
- **预期**：「笔记标题」「支持 Markdown」
- **实际**：`笔记标题…` / `在此编写…  支持 Markdown，可用 {{变量名}} 占位`
- **影响**：非功能缺陷，语义一致

### [ADVISORY] 复杂输入法 + 长文档组合
- **反模式**：中文 IME 候选 + 长文滚动 + 选区气泡
- **预期**：光标与浮层定位稳定
- **实际**：未在本轮 Electron 环境复现；建议发布前 10 分钟人工抽查
- **证据**：— 

### [ADVISORY] 产品文案混用「便签/笔记」
- **反模式**：全局叙事一致性
- **预期**：用户可见面统一「笔记」
- **实际**：README/PRIVACY 部分仍写「便签」（制作人 acceptance P3）
- **影响**：非阻塞

## 浏览器 Harness 摘要（`evidence/qa-harness.html`）

```
PASS XSS script/onerror stripped
PASS Preview renders h2/list/code
PASS Footer icons mount SVG (note/eye/star)
PASS Ctrl+Z undoes insertText
PASS Slash trigger regex
```

## 缺陷清单（按严重度）

| 级别 | 标题 | 状态 |
|------|------|------|
| — | 无 BLOCKING / P1 缺陷 | — |
| P2 | footer 图标 Electron 真机目视 | 已缓解（CSS + data-icon 修复）；harness SVG 挂载 PASS；建议发布前补截图 |
| P3 | 文案「便签/笔记」混用 | 开放（ADVISORY） |
| P3 | 内部记忆摘要仍用「提示词」措辞 | 开放（用户不可见，ADVISORY） |

## 结论

- [x] **PASS — 可进入 `/gate-check`**
- [ ] 不通过，打回开发

**理由**：硬门禁全通过；Smoke/回归/反模式核心项已覆盖；已知 P1（Ctrl+K、Tab）已修复并验证；无阻塞缺陷。

## 证据目录

| 文件 | 状态 |
|------|------|
| `evidence/dev-self-test.md` | ✅ 齐全 |
| `evidence/test-report.md` | ✅ 本文件 |
| `evidence/code-review.md` | ✅ 齐全（上级 `code-review.md`） |
| `evidence/qa-harness.html` | ✅ 浏览器辅助验证 |
| `evidence/screenshots/` | ⚠️ 目录已建，**无 PNG**（软项 ADVISORY，不阻塞 gate-check） |
