# Code Review: rename-knowledge-menu-to-web

## 审查范围

- `src/workspace.html` — `#btnKnowledgeOs` 可见文案
- `src/workspace.js` — drawer 标题、welcome kicker、Obsidian 边界定位、打开 toast
- `tests/knowledge-web-naming.test.js` — 新增
- `tests/agent-rail-quick-entry.test.js` — rail 标签期望更新

## 检查项

- [x] 符合 OpenSpec specs（rail「知识网」、顶层标题、个体库保留）
- [x] 无多余 scope 改动（未碰 AI/feishu/workbench/标识符）
- [x] IPC/安全边界正确（无 IPC 变更）
- [x] 性能无明显退化（纯文案）

## 边界记录（拿不准处）

| 位置 | 决定 | 理由 |
|---|---|---|
| `rail-foot` `aria-label="知识库与设置"` | **保留未改** | 指 foot 工具栏分组名，非 `#btnKnowledgeOs` 本身；避免扩大 scope |
| `renderKnowledgeStatusWorkspace` `<h1>知识库已就绪</h1>` | **保留** | 指当前个体库就绪，非整体「知识网」 |
| `openKnowledgeOsPanel` 错误文案「知识库加载失败」 | **保留** | 指当前库实例加载失败 |
| 连接页「选择…使用的知识库」 | **保留** | 个体源选择 |
| `workspace.html:4702`「查文档/知识库」 | **保留** | 聊天空态泛指，非顶层菜单 |

## 结论

- [x] 已完成
- 审查人：developer agent
- 日期：2026-08-09
- 备注：可交测试 QA；建议测试反模式验证 rail 连点开关与 tab 切换回归。
