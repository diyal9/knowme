# QA Plan: polish-daemon-artifacts-folder

## Smoke Scope（必填）
- [ ] 失败任务 · 制品 Tab · 0 文件：图标空态 + 失败说明，无「点击预览」tip，可切到步骤
- [ ] 有制品列表：文件行含图标与文件名，预览可用

## Regression Scope
- [ ] 步骤 / 变更 / 事件 Tab 无回归
- [ ] 代码工作区入口与行为不变

## Anti-pattern Checks（交给测试）
- [ ] 空态不出现假文件行
- [ ] 进行中与失败空态文案可区分
- [ ] 窄栏下文件名截断不遮挡操作按钮
