# 开发就绪检查

## 结论

规格已达到开发可执行状态。开发从 tasks A1 开始，按 `implementation-map.md` 的七个切片推进；每个公共切片必须同步运行 partner、expert、workflow 兼容回归。

## 已解决的设计决策

- 公共层范围：Context phase、Run identity、V2 reducer、事实源、approval/recovery。
- 首批消费者：专家协作；伙伴与工作流同时做兼容适配和回归。
- 事实源：Session message / Run event / Task / Artifact / host receipt 分工明确。
- 规划协议：新任务结构化 outcome，主进程校验；旧任务文本 reader 只做兼容。
- 确认边界：用户合同、内部执行计划、工具批准、成果验收分别建模。
- 重试：新 runId + lineage；工作流保留 root/child/node attempt。
- 取消：冻结用户可见终态，保留真实迟到 receipt，不继续派发。
- 迁移：additive field + versioned writer + deterministic legacy reader，无批量历史重写。
- 回滚：只回退新 planning writer；V2 拒绝、权限和批准安全边界保持。

## 开发输入完整性

| 输入 | 状态 | 位置 |
|---|---|---|
| 业务目标、用户价值、非目标 | 完整 | `proposal.md` |
| 架构、数据权威、生命周期和迁移 | 完整 | `design.md` |
| 可测试行为合同 | 17 requirements / 41 scenarios | `specs/*/spec.md` |
| 两小时内实施任务 | 54 项 | `tasks.md` |
| 文件、测试和提交顺序 | 完整 | `implementation-map.md` |
| 故障注入和跨 lane QA | 完整 | `qa-plan.md` |
| 制作人体验验收 | 完整 | `acceptance.md` |
| 审查清单与证据目录 | 已准备 | `code-review.md`、`evidence/README.md` |

## 开始实现命令

```powershell
node .cursor/scripts/harness.js preflight --json
openspec validate converge-knowme-agent-runtime-contracts --strict
```

随后执行 A1/A2 失败基线；修改任何源码符号前执行 GitNexus upstream impact。

## 当前仓库基线

- OpenSpec strict validation：通过。
- Harness preflight：通过。
- Story gate 的 npm test、lint、renderer typecheck、lib typecheck：通过。
- Renderer 全量测试当前存在 1 个与本 change 无关的既有失败：`surface-css-contract.spec.ts` 期望 capability hub 搜索框宽度为 214px。该 CSS/test 在本 change 创建前已处于工作区修改状态。
- 全局 `openspec:health` 因活跃 change 数为 22，且其他 change 缺少材料而返回非零；本 change 未被列入任何缺项。

上述两个仓库基线问题不阻止开始本 change 的开发，但 Story 完成前必须重新运行门禁，并区分本 change 回归与既有工作区问题。
