# QA Plan：执行进度视觉精修

## Smoke Scope（必填）

- [x] 无执行轨迹时显示单一等待状态；首条轨迹到达后等待浮条立即移除，只保留执行进度卡片。
- [x] 运行中卡片只在标题区显示一次总耗时，当前步骤清晰突出，已完成步骤紧凑且仍可读。
- [x] 同一步骤的“查看 N 条资料”和步骤耗时对齐稳定，窄窗口下不重叠且入口可操作。
- [x] 展开资料后后续计时更新不关闭详情、不重播未变化步骤动画。
- [x] 回答完成后执行过程原地折叠；存在 pending_review 时继续展开并保留批准/拒绝入口。（既有全量契约回归）

## Regression Scope

- [x] Agent v2 progress/tool 事件仍归并到稳定步骤，不生成重复行。
- [x] 结构化回答、滚动锚点和 assistant 正文节点不因时间线更新被替换。
- [x] 错误、取消、子 Run 与审批步骤仍使用原有状态和动作。
- [x] reduced-motion 下无持续呼吸或脉冲动画。

## 自动化

- `node --test tests/workspace-agent.test.js`
- `npm test`
- `npm run lint`
- `openspec validate polish-agent-execution-progress --strict`

## Anti-pattern Checks（交给测试）

- 卡片与外部浮条重复显示“正在组织回答”或相同耗时。
- 完成项因对比度过低看起来像禁用或不可读。
- 当前步骤大面积铺色、图标和文字未对齐，造成视觉噪音。
- 结果入口、步骤耗时和折叠箭头使用不同交互语法或挤压标题。
- 窄窗口下“查看 N 条资料”消失、截断或与耗时重叠。
