# QA Plan — relocate-workflow-copy-to-manage

## Smoke Scope

- [ ] 工作流首页：官方/团队卡 footer 仅运行按钮
- [ ] 工作流首页：我的卡 footer 仅运行按钮（无编辑）
- [ ] 维护管理：卡上复制在编辑左侧，删除仍在
- [ ] 点击复制：生成新「我的」流程，toast 成功
- [ ] 控制台无 uncaught error

## Anti-patterns

- [ ] 首页不再出现复制图标误触
- [ ] 复制不会静默失败（无 Key/API 时有错误 toast）
