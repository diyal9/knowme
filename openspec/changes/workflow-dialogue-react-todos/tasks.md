## 1. To-dos UI（agent-chat-ux）

- [ ] 1.1 将 `renderPlanChecklist` 标题改为「To-dos {n}」风格，并可附剩余提示
- [ ] 1.2 区分 doing / pending / done / blocked 标记（对齐 Cursor 箭头与虚线圆语义）
- [ ] 1.3 更新 `workspace.html` 中 `.agent-plan-*` 样式与可访问性 aria-label

## 2. 工作流 ReAct 策略（workflow-dialogue-react / agent-run-plan）

- [ ] 2.1 检测 Session `workflowId`，注入 ReAct developer/system 指令（思考→计划→执行→验收）
- [ ] 2.2 多步工作流 Run：首轮循环内确保非空 plan（提示强制 + 可选步骤种子，全 pending）
- [ ] 2.3 确认既有 plan self-verify / 预算扩展对 workflow 会话仍然生效
- [ ] 2.4 非 workflowId 会话不硬强制 ReAct

## 3. 工作台对话房（workspace）

- [ ] 3.1 确认货架进入的工作流 task-room 左栏能渲染并增量更新 To-dos
- [ ] 3.2 右栏工作流属性不冒充执行清单；必要时加简短「进度见对话 To-dos」提示

## 4. 测试与证据

- [ ] 4.1 单测：plan 渲染文案/状态标记；workflow 策略门控（有/无 workflowId）
- [ ] 4.2 回归：`agent-plan-tools`、`agent-stream-repaint`、工作流对话打开路径
- [ ] 4.3 `npm test` + `npm run lint`；写 `evidence/dev-self-test.md`（含截图路径约定）
