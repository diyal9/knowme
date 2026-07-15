# 测试报告: list-context-menu

## 门禁

- [硬] npm test: **PASS** (45/45)
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: **已执行**（结构断言 + 主进程菜单模板审查）
- [软] code-review: **已完成**

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 行右键绑定 | PASS | `list.html` `contextmenu` + `showListContextMenu` |
| 菜单项精简 | PASS | `main.js` list 模板仅 打开/收藏/条件展开/删除 |
| 无多余项 | PASS | 断言无「复制全文」「收录到知识库」；list 通道不含关闭窗口 |
| 多版本展开 | PASS | `data-group-key` + `list-open-group` → `openProjectGroup` |
| 删除确认 | PASS | 双按钮、`defaultId/cancelId=1`；确认后 `deleteNoteF` + `init-list` |
| 左键/星标回归 | PASS | 既有 click / `data-fav` 未改破坏面 |
| 便签窗口菜单回归 | PASS | `show-context-menu` 模板保留完整项 |

## 反模式发现

### [ADVISORY] 折叠行删除只删最新一版
- **反模式**：用户以为删「ide_tina」整组
- **预期**：可能想批量清版本
- **实际**：仅删当前行对应 noteId（最新）
- **建议**：本版符合「单卡操作」；若投诉增多再加「删除全部版本」

### [ADVISORY] 侧栏项目名无右键
- **反模式**：右键侧栏 `ide_tina` 子项
- **预期**：也能删/打开
- **实际**：无菜单（本版仅卡片行）
- **建议**：非本版范围，可接受

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/`（本报告 + `dev-self-test.md`）
