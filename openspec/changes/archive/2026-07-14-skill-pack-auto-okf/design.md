# Design: skill-pack-auto-okf

## 架构

```
便签保存 (main note-update)
  → skillPack.scanSuggestions(notes, themeState)
  → BrowserWindow.send('skill-pack-suggest', { theme, count, noteIds })

用户确认封装
  → IPC skill-pack-generate({ theme })
  → 对每张 eligible note：chatCompletionOnce 生成正文（无 Key 则本地模板）
  → productKnowledge.writeSkillConcept → skills/<slug>.md
  → 回写 note.skillPackConceptId / okfConceptId
  → 更新 index.md + log.md + themeState=packed

设置编辑
  → knowledge-write-concept({ id, title, body })
  → 校验 frontmatter.type 后写盘 + lint

AI 助写
  → getSkillContext(knowledgeDir, { category }) 拼入 dynamicContext
```

## IPC

| 通道 | 进程 | 说明 |
|------|------|------|
| `skill-pack-check` | invoke | 返回当前待提示主题列表 |
| `skill-pack-suggest` | event → 渲染 | 保存后推送 |
| `skill-pack-generate` | invoke | AI 生成并写 OKF |
| `skill-pack-dismiss` | invoke | 暂不（写 themeState） |
| `knowledge-write-concept` | invoke | 设置页保存 |

## 数据

- 技能 OKF：`%APPDATA%\sticky-notes\knowledge\skills\*.md`
  - frontmatter：`type: Concept`、`skill_pack: true`、`source_note_id`、`theme`、`tags`
- 主题状态：`%APPDATA%\sticky-notes\memory\skills\theme-state.json`
- 便签字段：`skillPackConceptId`

## 性能

- 扫描在 note-update 同步轻量完成（笔记数量级通常 <500）
- AI 生成串行每张便签，超时沿用 chatCompletionOnce；无 Key 本地模板，保证可离线落盘
