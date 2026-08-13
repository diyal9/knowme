## 1. Graph inspection

- [x] 1.1 在 `workbench-studio-model.js` 实现 `inspectStudioGraph`（结构+绑定+walk）
- [x] 1.2 单测覆盖通过/失败与 walk 顺序

## 2. Save confirm dialog

- [x] 2.1 工具栏保存 → `studio-save` 弹层（可编辑目标、多列节点、页脚按钮）
- [x] 2.2 确认保存才调用 `saveStudioWorkflow`；禁止 pendingGoal 污染目标
- [x] 2.3 弹层 CSS 整洁化

## 3. Check preview animation

- [x] 3.1 工具栏「检查流程」干跑：不保存、不启动
- [x] 3.2 节点/边检查动画与失败停步提示
- [x] 3.3 `npm test` && `lint`；写 `evidence/dev-self-test.md`
