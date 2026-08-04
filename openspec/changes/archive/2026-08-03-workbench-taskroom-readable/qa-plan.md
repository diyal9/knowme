# QA 计划: workbench-taskroom-readable

## Smoke Scope

- [ ] 启动应用进入「任务工作间」右栏，状态区为「结论 + 一行说明」，无多行键值对文字墙
- [ ] 完成态任务：顶部 meta 显示「已完成」，与进度标签、结论一致，不出现「流程执行中」
- [ ] 等待审批任务：结论显示「等待你确认」，使用琥珀色（非成功绿）
- [ ] 降级任务（内容源不匹配）：说明不含 `team-run` / `.cursor/workflows/`；「参与助手」仅一句短提示
- [ ] 颜色语义：绿色仅出现在完成/成功；执行中、等待、失败、降级各有区分色
- [ ] 界面不出现「禁止把任务输入路径当作产物…」等内部规则串

## 测试用例

| # | 场景 | 步骤 | 预期 |
|---|---|---|---|
| 1 | done 任务 | 打开一个已完成任务 | 结论「任务已完成」+绿点；meta「已完成」；进度绿标 100% |
| 2 | gate 等待 | 打开待审批任务 | 结论「等待你确认」+琥珀点；下一步框中性/引导审批 |
| 3 | clarification | 打开待澄清任务 | 结论含「补充信息」 |
| 4 | running | 执行中任务 | 结论「正在执行」+蓝灰点；进度中性色 |
| 5 | degraded | 内容源不匹配 | 结论「流程详情暂不可用」；说明无 id/路径；参与助手一句短提示 |
| 6 | 文案安全 | 任一状态 | 界面不出现「禁止把任务输入路径当作产物…」等内部规则串 |

## 反模式挑战（Tester 视角）

- 快速在 done / running / degraded 间切换，观察 tone 类是否残留（`elRunProgress.className` 每次重设）
- 极长 headline / detail 是否溢出（detail `text-wrap:pretty`，headline 单行加粗）
- HTML 注入：headline/detail 经 `esc()` 转义

## 单测覆盖

- `tests/workbench-task-brief.test.js`：tone/headline 分支
- `tests/workbench-task-projection.test.js`：degradedReason 去黑话断言
