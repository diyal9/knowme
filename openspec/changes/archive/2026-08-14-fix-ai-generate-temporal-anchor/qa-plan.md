# QA Plan — fix-ai-generate-temporal-anchor

## Smoke Scope

- [ ] 工作台 → 打开专家「办公伙伴」→ 发送「你好」→ 正常回复，无 ReferenceError / Error invoking
- [ ] 再发「？」仍可正常生成
- [ ] 生成中点停止：能取消；无空 cancelSubRun 残留（子任务场景若可造则测）
- [ ] 人为制造失败时气泡为人话（如「暂时无法完成回复，请重试」），不含 `Error invoking remote method`
