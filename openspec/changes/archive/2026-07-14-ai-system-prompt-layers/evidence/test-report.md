# 测试报告: ai-system-prompt-layers

## 门禁

- [硬] npm test: **PASS**（57/57）
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: **已执行**
- [软] code-review: **已完成**

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 设置标签「用户偏好提示词」+ 可空保存 | PASS | `settings.html` + `settings-secure` 默认 `userPrompt: ''` |
| 空偏好仍有底座 | PASS | `buildSystemContent` 单测；无空「用户偏好」块 |
| 偏好注入顺序 | PASS | 底座 → 用户偏好 → 动态上下文 |
| 多轮 history | PASS | `note.html` `priorHistory`；messages 含上轮；`maxTurns` 截断 |
| 旧默认迁移为空偏好 | PASS | `settings-secure` + `resolveUserPrompt` 单测 |
| 自定义旧 systemPrompt 保留 | PASS | 迁移为 `userPrompt` 并落盘 |

## Regression

| 用例 | 结果 | 备注 |
|------|------|------|
| 无 API Key 提示 | PASS | `ai-generate` 开头校验保留 |
| KB/Memory 注入 | PASS | `dynamicContext: memCtx` |
| `ai-suggest-title` 独立 system | PASS | 仍用固定短指令，不读 `userPrompt` |

## 反模式发现

### [ADVISORY] 真实模型风格感知需人工
- **反模式**：仅看契约断言「偏好会影响回复」
- **预期**：C 端能感知风格变化
- **实际**：无 Key 环境无法测采样质量；注入契约已硬保
- **建议**：带 Key 走查一次列表优先类偏好即可

### [ADVISORY] 超长单条按字符截断
- **反模式**：粘贴超长便签 + 超长历史
- **预期**：模型仍看到关键指令与本轮需求
- **实际**：history/便签按字符截断；本轮 user 始终在末尾
- **建议**：可接受；后续可按 token 粗估

### [PASS] 无法抹掉底座
- 设置 UI 无完整 system 编辑入口；偏好冲突声明以底座为准

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/`（本报告 + `dev-self-test.md`）
