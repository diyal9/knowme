# Code Review: fix-create-skill-drawer

## 范围

- `src/settings.html`（`openCreateSkillDrawer` / `kbDrawerMode` / 保存分支）
- `tests/slash-skill.test.js`（禁 `window.prompt` 契约）
- `openspec/specs/slash-skill/spec.md`

## 结论

- **PASS**：根因正确（Electron 禁用 `prompt`）；新建走抽屉，create/edit 模式分离清晰
- 新建态隐藏「实例化为卡片」，避免无 conceptId 误点
- 创建成功后 `openConceptPreview` 切回编辑态，闭环完整
- 单测锁定不再使用 `window.prompt(`

## 后续建议（非阻塞）

- 中文标题默认 slash 仍偏弱，可引导必填英文命令
