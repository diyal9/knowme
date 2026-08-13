# QA Plan: establish-knowme-evals-system

## Risk Focus

1. 引入跨产品对比后，评估公平性失真（输入或评分不一致）。
2. 评估维度扩展后，门禁噪音上升导致误报。
3. 新增 L1/L2 套件影响现有离线硬门禁稳定性。
4. 失败报告不可追溯，无法定位到场景和归因标签。

## Smoke Scope

- [x] L0 suite 在无 API key、无外网环境可稳定通过（历史 hard case 不回退）。
- [x] L1 suite 能输出真实运行态指标（latency/recovery/cancel）且字段完整。
- [x] L2 suite 使用同任务同输入同评分，三产品结果可归一到统一 schema（Cursor/Workbuddy 当前 BLOCKED 骨架）。
- [x] 任一失败都可定位到 `scenario + dimension + failReason`。
- [x] JSON/Markdown 报告可被团队直接审阅与后续脚本消费。

## Automated Commands (Draft)

```bash
npm test
npm run lint
npm run test:agent-eval -- --out openspec/changes/establish-knowme-evals-system/evidence/eval-report
node scripts/agent-eval.js --suite hard-offline --baseline v1 --out openspec/changes/establish-knowme-evals-system/evidence/eval-report
npm run eval:l1
node scripts/agent-benchmark.js --suite core-10 --out openspec/changes/establish-knowme-evals-system/evidence/benchmark-report
node .cursor/scripts/harness.js gate --json
```

## Manual QA Checklist

- [ ] 审查 10 个核心对比任务描述，确认可被三平台公平执行。
- [ ] 抽查 3 个失败案例，验证归因标签正确（如 missing_tool、ungrounded_claim）。
- [ ] 抽查 3 个通过案例，验证 evidence/ledger 与结论一致。
- [x] 校验 hard 与 advisory 维度边界，避免将非确定性评分放入硬阻断。

## Exit Criteria

- L0 硬门禁不退化；L1/L2 套件输出稳定且可解释。
- 报告可形成改进优先级列表，不仅有总分。
- 证据与工件完整，满足开发自测 -> 制作人验收 -> 测试接入流程。
