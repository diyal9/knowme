# QA Plan — refine-expert-editor-ux

## Smoke Scope

- [ ] 打开「添加自己的专家」：弹窗明显更大，无横向溢出
- [ ] 头像单行可横滑；无「按名称匹配」按钮/说明；默认已选中一张
- [ ] 打开 AgenticType：五项之间有横线；切换后附属配置正确刷新
- [ ] ReAct 下「允许使用工具 / 允许反思修订」勾选框与文字同行
- [ ] Skills 点「选择」打开二级弹窗；确认后摘要与底栏计数更新
- [ ] 无已安装 Skill 时看到「先安装再选择」引导
- [ ] 保存后专家 Skills / avatar / agenticType 与改造前一致

## Anti-patterns

- 窄窗口下头像行或下拉被裁切
- Esc 关掉整个编辑器而不是先关 picker
- 手动选头像后又被改名覆盖
