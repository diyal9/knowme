# QA Plan: refine-pipeline-service-visuals

## Smoke Scope（必填）

- [ ] 工作台 → 管线服务：连接条「已连接」与「刷新」垂直对齐
- [ ] 表单标签/输入字号可读；聚焦 select/textarea 有绿色焦点环
- [ ] 在线且目标 ≥20 字时「开始开发」为 accent 绿；不足时灰禁用
- [ ] 右栏任务卡标题/副文可读；选中态为 accent 描边（非纯黑）

## Regression Scope

- 管线服务开工校验（字数/材料）逻辑不变
- 离线时开工禁用与「重试」仍可用
- 工作流 Tab 货架样式不受影响

## Anti-pattern Checks（交给测试）

- 主按钮仍是死黑大块 → FAIL
- 右栏字号仍难读 / 连接条错位 → FAIL
- 焦点环缺失或成系统默认蓝 → FAIL
