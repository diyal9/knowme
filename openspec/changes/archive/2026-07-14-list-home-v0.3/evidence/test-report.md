# 测试报告: list-home-v0.3

## 门禁

- [硬] npm test: **PASS** (33/33)
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: **已执行**（结构 + 逻辑审查 + 单测）
- [软] code-review: **已完成**

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 总览侧栏主题与计数 | PASS | `themeRail` / 未分类 / 计数渲染 |
| 点击主题可筛选 | PASS | `themeKey` 过滤逻辑审查 |
| 行内 okfTags 可见 | PASS | `chip-tag` / `coreTags()` |
| 搜索 + 主题叠加 | PASS | getSorted 顺序叠加 |
| 打开便签 / Esc / 新建 | PASS | IPC 未改破坏面；既有 focus-note |

## 反模式发现

### [ADVISORY] 大量未分类时侧栏信息弱
- **反模式**：全部卡片无 category
- **预期**：仍能管理
- **实际**：多数落入「未分类」，主题轨价值下降
- **建议**：引导 AI 分类（非本版 BLOCKING）

### [ADVISORY] 标签 chip 最多 3 个
- **反模式**：卡片有 5+ tags
- **预期**：看到全部
- **实际**：只显示前 3
- **建议**：可接受；tooltip 可后续展示剩余

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/`（本报告 + `dev-self-test.md`；GUI 截图可选补）
