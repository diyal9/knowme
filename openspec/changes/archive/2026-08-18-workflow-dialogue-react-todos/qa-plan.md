# QA Plan: workflow-dialogue-react-todos

## Smoke Scope（必填）

- [ ] 货架打开工作流对话房 → 发送多步目标 → 左栏出现「To-dos N」清单
- [ ] 执行中 To-dos 状态从 pending/doing 变为 done（至少一项可见更新）
- [ ] 计划未完成时终态不宣称「全部完成」
- [ ] 无 workflowId 的专家简单问答不强制出现 To-dos / 不异常失败

## Regression Scope

- [ ] 工作流货架入口仍进双栏对话房（非详情弹层主路径）
- [ ] `update_plan` 工具与 plan 持久化仍可用
- [ ] 助手流式气泡 / thinking 等待态无回退
- [ ] Artifact 写盘仍需用户批准

## Anti-pattern Checks（交给测试）

- [ ] 用静态 Markdown 勾选列表冒充 To-dos（无结构化 plan）
- [ ] 右栏步骤列表被当成实时执行进度
- [ ] 假进度：种子项直接标 done
- [ ] 非工作流会话被硬 ReAct 打扰
- [ ] To-dos 过长撑破气泡或无法滚动到最新消息
