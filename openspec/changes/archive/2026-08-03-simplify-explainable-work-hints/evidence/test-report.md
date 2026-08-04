# 测试报告: simplify-explainable-work-hints

## 门禁

- [硬] npm test: PASS（开发自测 739/739；本轮归档前 gate 复跑）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 默认仅简短可勾选项 | PASS | 详情默认 `display:none`；截图 `screenshots/work-hints-default.png` |
| 悬停/聚焦显示具体内容+原因 | PASS | 聚焦后 `display:grid`；截图 `screenshots/work-hints-explained.png` |
| 勾选填入可编辑、不自动发送 | PASS | `change` 仅写 `aiInput` + toast；无 `runAI` |
| 隐藏整组 / 输入中隐藏 | PASS | `workHintsDismissed` + 有 draft / `activeRunId` 时清空 |

## 反模式发现

### [ADVISORY] 触屏无法悬停看解释
- **反模式**：无鼠标悬停的触控场景
- **预期**：仍能理解为何推荐
- **实际**：依赖勾选后看输入框内容；浮层需 hover/focus
- **证据**：设计已记录为 Windows 桌面目标平台可接受

### [ADVISORY] 勾选后选中态停留极短
- **反模式**：勾选后立刻因输入态隐藏提示条
- **预期**：短暂确认视觉
- **实际**：靠 toast「已填入…」反馈
- **证据**：code-review 非阻塞项

无 BLOCKING。

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/screenshots/`
