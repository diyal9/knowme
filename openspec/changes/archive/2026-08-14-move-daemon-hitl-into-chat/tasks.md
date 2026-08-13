## 1. Brief 文案与契约

- [x] 1.1 更新 `workbench-task-brief.js`：Gate/澄清的 nextAction、waitingDetail 引导「在左侧对话」完成
- [x] 1.2 更新 `tests/workbench-task-brief.test.js` 断言

## 2. 对话区 HITL

- [x] 2.1 `workspace-agent.js`：按 waitingKind upsert `daemon-hitl` 消息并渲染卡片（澄清提问 / Gate 按钮）
- [x] 2.2 澄清等待时拦截 Composer 发送 → `workbenchDaemonClarify`；成功后展示用户消息并刷新占位
- [x] 2.3 Gate 卡片点击 → `workbenchDaemonGate`；暴露/回调让 workbench 刷新任务
- [x] 2.4 HITL 卡样式（对话气泡内，不遮挡 Composer）

## 3. 去掉底栏回答与弹窗主路径

- [x] 3.1 `renderDaemonRunner` 移除 `daemon-clarify` 与 Gate 底栏按钮
- [x] 3.2 移除/停用 clarify 模态打开路径（`daemon-clarify` action、modal.kind === 'clarify' 主入口）
- [x] 3.3 workbench 注册 HITL 提交回调（clarify/gate）并 `refreshDaemonTask`

## 4. 自测与证据

- [x] 4.1 `npm test` / `npm run lint`
- [x] 4.2 写 `evidence/dev-self-test.md`；必要时补 templates 契约断言
