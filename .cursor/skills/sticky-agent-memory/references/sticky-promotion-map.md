# StickyNotes 升库映射

用户确认「写入 OKF」时，按内容类型选路径：

| 记忆内容 | OKF 目标 | type |
|----------|----------|------|
| 产品行为/边界 | `concepts/<slug>.md` | Concept |
| 架构/Electron/IPC | `concepts/<slug>.md` | Playbook |
| 技术决策 | `decisions/<slug>.md` | Decision |
| 开发/测试 SOP | `processes/<slug>.md` | Playbook |
| Story 复盘综合 | `brain/memory/working/` → ingest 到 `concepts/` 或 `processes/` | Synthesis |
| 与现有 OKF 争议 | 新建 `decisions/<slug>.md` 标注 Conflict | Decision |

## ingest checklist

1. 列目标路径 + Concept ID
2. 双向补链（wiki ↔ knowledge）
3. 更新 `brain/knowledge/index.md` + `log.md`
4. `npm run kb:lint`
5. `patterns/registry.json` → `promoted_kb`

## 建技能 checklist

1. 制作人批准
2. `/evolve` → `team-learned-<topic>/SKILL.md`
3. 登记 `brain/knowledge/processes/team-skills.md`
4. `registry.json` → `promoted_skill`

## 示例

- 用户三次确认「便签关闭按钮是删便签不是退出应用」→ `concepts/note-lifecycle.md`
- 用户三次跑「story-done 前必须 gate-check」→ `processes/story-done-gate.md`
