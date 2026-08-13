# Acceptance: establish-knowme-evals-system

## Product Acceptance Goals

- KnowMe 评估体系从“单层回归”升级为“自评 + 竞品对比”的可运营机制。
- 团队可基于统一报告判断质量走势和竞品差距，而非主观感受。
- 评估结果可直接映射到下一轮实现优先级。

## Acceptance Checklist

- [x] 评估分层（L0/L1/L2）定义清晰，执行入口可用。
- [x] 自评维度覆盖正确性、工具质量、安全、效率、恢复性。
- [x] Cursor/Workbuddy 对比框架具备统一任务与评分规则（KnowMe 可跑，竞品适配器 BLOCKED 骨架）。
- [x] 报告中有汇总指标、分场景明细和失败归因。
- [x] hard/advisory 分层明确，避免噪音阻断日常研发。

## Evidence

- `openspec/changes/establish-knowme-evals-system/evidence/eval-report.json`
- `openspec/changes/establish-knowme-evals-system/evidence/eval-report.md`
- `openspec/changes/establish-knowme-evals-system/evidence/benchmark-report.json`
- `openspec/changes/establish-knowme-evals-system/evidence/benchmark-report.md`
- `openspec/changes/establish-knowme-evals-system/evidence/dev-self-test.md`

## 开发结论（2026-08-13）

L0 离线硬门禁 10/10 通过；L1 nightly 18/18 advisory 通过；L2 core-10 KnowMe 10/10，Cursor/Workbuddy 适配器待 live 配置后启用。
