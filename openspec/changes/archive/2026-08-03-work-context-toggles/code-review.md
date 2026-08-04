# 代码评审

## 结论

输入框上方工作提示条整段下线，范围干净；记忆后端保留。可归档。

## 检查

| 项 | 结论 |
|---|---|
| `workspace-agent.js` 无残留 `renderWorkHints` / `scheduleWorkHintsRefresh` / `memoryToggles` 发送 | 是 |
| 测试改为断言 UI 不存在 | 是 |
| `product-memory.js` / 主进程注入未误删 | 是 |
| XSS / 自动发送等无关 | N/A（UI 已移除） |

## 备注

`buildWorkHints` 与 `includeUserPrompt` 选项暂留：前者供未来意图推荐复用，后者默认 `true` 不影响现网。
