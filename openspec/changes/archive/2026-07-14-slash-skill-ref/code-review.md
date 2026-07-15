# Code Review: slash-skill-ref

## 范围

- `src/lib/product-knowledge.js`（listSkills / createSkill / parseSlashTokens / getSkillContext）
- `src/lib/skill-pack.js`（封装时写入 slash）
- `src/main.js` / `src/preload.js` / `src/note.html` / `src/settings.html`
- `tests/slash-skill.test.js`

## 结论

- **PASS**：slash 规范化与重名分配清晰；助写从 prompt 解析令牌并优先注入
- `/` 菜单键盘导航齐全（↑↓ Enter Tab Esc）
- 设置新建 + 编辑 slash 闭环完整
- 与 Cursor/`brain/` 开发技能无关，产品技能仅落 `knowledge/skills/`

## 后续建议（非阻塞）

- slash 命令目前限 ASCII；中文技能标题需用户自定义英文命令
- 新建技能现用 `prompt()`，后续可换成抽屉内联表单
