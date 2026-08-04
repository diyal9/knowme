# Code Review: agent-task-preflight-ask

- 日期：2026-08-03
- 审阅范围：`src/workspace-agent.js`（新增 preflight 层）

## 检查项

| 项 | 结论 | 说明 |
|----|------|------|
| 变更聚焦 | PASS | 仅改单文件渲染层，未动主进程 / LLM 协议 / 连接器 |
| 复用而非重写 | PASS | 复用 `runOfficeShortcut` / `enrichOfficeShortcutPrompt` / `readFeishuConnector` / `mergeShortcutPromptWithComposer` |
| 缺内容不调用 LLM | PASS | `askForTaskContent` 仅推 system-note + 聚焦输入框，无 `runAI` / `aiGenerate` 调用 |
| 续跑正确性 | PASS | `pendingShortcut` 在 `runAI` 顶部消费并清空；自由提问不受干扰（无素材即清空） |
| 向后兼容 | PASS | 无 spec 任务回落 `runQuickStarter`；enricher 对写作/编程 prompt no-op 透传 |
| 误判风险 | LOW | material 仅取输入框文本 + 附件，不含可能过期的编辑器上下文 |

## 潜在改进（非阻塞）

- 飞书授权类可加"一键打开设置 → 连接器"按钮（当前保守只给文案，属 Non-goal）
- 一句话询问用 system-note 会替换空态卡片视图；已用 `pendingShortcut` 消除二次点击摩擦，实机体验以 qa-plan 冒烟为准

## 结论

✅ 通过。硬项（test/lint）全绿，逻辑聚焦、可回退、风险低。软项冒烟待制作人 / 测试按 qa-plan 实机核对。
