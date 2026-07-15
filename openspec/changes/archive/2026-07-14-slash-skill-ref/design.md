# Design: slash-skill-ref

## 数据

技能 `skills/*.md` frontmatter 增加：

```yaml
slash: code-review   # 助写内 /code-review
skill_pack: true
```

无 `slash` 时由标题派生 ASCII 命令；重名时加后缀。

## 流程

```
设置「新建技能」→ createSkill → skills/<slug>.md
AI 输入 /xxx → listSkills → 弹出菜单选中 → 插入 /slash
发送 → 解析 prompt 中 /tokens → resolveSkillRefs → getSkillContext({ slashRefs })
```

## IPC

| 通道 | 说明 |
|------|------|
| `list-skills` | 返回 { id, title, slash, description }[] |
| `create-skill` | { title, slash, body } → 写盘 |
| `ai-generate` | 增 `skillRefs` / 或主进程自解析 prompt |

## UI

- `note.html`：`#slashMenu` 浮层于 `#aiInput` 上方
- `settings.html`：知识库工具栏「新建技能」；抽屉增加 slash 输入
