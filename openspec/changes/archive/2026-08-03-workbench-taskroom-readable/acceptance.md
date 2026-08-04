# 制作人体验验收: workbench-taskroom-readable

从 C 端用户视角，检验「任务工作间」右栏是否符合人的阅读 / 操作 / 认知习惯。

## 核心路径

| 路径 | 结论 | 证据 |
|---|---|---|
| 状态区不再是键值对文字墙，改为「结论 + 一行说明」 | 通过 | `renderTaskContext` 用 `statusHeadline` + `statusDetail` 结构渲染，不再 `textContent = factualBrief` |
| 内部规则文案（「禁止把任务输入路径当作产物…」）不外泄 | 通过 | `factualBrief` 仅用于 LLM 注入，不进 DOM |
| `done` 任务不再「流程执行中」与「已完成 100%」矛盾 | 通过 | `renderDaemonRunner` meta 在 done 时显示「已完成」，与进度/结论一致 |
| 降级原因不暴露 `team-run` / `.cursor/workflows/` 路径 | 通过 | `userFacingDegradedReason` 去 id/路径，projection 单测断言 |
| 「参与助手」降级提示不与「执行节点」重复整段原因 | 通过 | 参与助手区压成一句短提示 |
| 绿色仅用于完成/成功 | 通过 | tone 语义色：完成绿、等待琥珀、执行蓝灰、失败红、降级灰；进度标签与下一步框默认中性 |

## 体验标准

- 一眼看懂「完了没 / 该干嘛」，不用逐行读日志
- 状态信号不打架，不谎报完成
- 失败/降级不制造焦虑，措辞可行动（去设置内容源）
- 视觉信号有区分度，绿色不再稀释

## 验收结论

- [x] 通过
- 验收人：制作人
- 日期：2026-08-03
- 备注：ADVISORY — 渲染层建议真机再扫一眼；分支由 `tone`/`headline` 纯函数驱动并已单测，逻辑侧可信。
