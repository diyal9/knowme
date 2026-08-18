## QA Plan — improve-agent-package-onboarding-ux

## Scope

- 导入向导：预检摘要、风险分级、兼容性判定、安装/取消、回滚入口。
- 运行态指引：等待/失败/取消/恢复的“下一步动作”与过程态反馈。
- 协议映射：新增诊断字段在 UI 的正确渲染与脱敏。

## Smoke Checklist

- [ ] 兼容 Package 导入：面板信息完整，可安装成功。
- [ ] 不兼容 Package 导入：fail-closed 阻断，修复建议可执行。
- [ ] WAITING_INPUT/WAITING_APPROVAL/WAITING_CHILD：均显示原因、推荐动作、预计等待。
- [ ] 失败态四分类（超时/权限/协议/证据）：均有修复动作入口。
- [ ] 父 Run 取消过程可见阶段过渡，终态后不再跳回运行中。
- [ ] 恢复失败时有明确失败原因和替代动作。

## Anti-pattern Checks

- [ ] 不出现“仅报状态不报动作”的死路文案。
- [ ] 不出现过程态被误渲染为完成态。
- [ ] 不在导入决策面板泄露敏感参数明文。

## Evidence

- Electron smoke JSON：`openspec/changes/improve-agent-package-onboarding-ux/evidence/`
- 截图目录：`openspec/changes/improve-agent-package-onboarding-ux/evidence/screenshots/`
- 门禁结果：`npm test`、`npm run lint`、`harness gate --json`
