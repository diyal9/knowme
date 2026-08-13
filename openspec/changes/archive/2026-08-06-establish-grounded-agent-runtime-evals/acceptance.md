# 制作人体验验收: establish-grounded-agent-runtime-evals

## 核心路径

- [x] **会议候选 → 回复 2（事故复现防护）**：展示候选后仅输入「2」；若未真正读取，助手不得给出具体议题/责任人/日期，不得声称已读取；应提示需读取或展示 blocked 状态。  
  → UAT-3：`feishu-meeting-pick-2-no-tool` + `grounding-meeting-e2e.json` layers.executor.blocked PASS；`screenshots/meeting-blocked.png`。
- [x] **会议候选 → 选 2 → 读取成功**：结构化绑定后调用 `feishu.meeting_read`；总结内容可与来源对照；UI 可查看来源/provenance。  
  → happy eval + feishu readonly probe（bodyLen=8635，哈希脱敏）；`screenshots/meeting-verified.png`。
- [x] **Truncated/空正文**：`thin-body-title-only` PASS。
- [x] **任务切换**：`task-switch-stale-facts` PASS。
- [x] **Legacy chat**：无 contract skill 不误阻断 PASS。
- [x] **Eval 报告**：7/7；事故 scenario 阻断不安全输出（mustFail 语义）。

## 体验标准

- [x] pending / verified / blocked 可区分，无虚假「已读取」。
- [x] blocked 文案可执行下一步；**全 bubble/meta/violation 无 raw tool id**（A1 已修复）。
- [x] badge 语义清晰；截图已采集。
- [x] **流式/grounding-status 增量更新后 `<details open>` 保持**（A2：capture/restore + patchAssistantGroundingMeta；smoke `details-open-survives-rerender` PASS）。
- [x] 拒答语气诚实，不甩锅 token。

## Skill 契约

- [x] 块级 YAML grounding contract（B1）
- [x] Skill → taskFrame → OutputGate（B2）
- [x] Legacy 兼容

## 商业化与信任

- C 端事故 fail-closed、结论可溯源；Skill 作者可声明 grounding 依赖。

## 验收结论

- [x] 通过 / [ ] 不通过 / [ ] 待真机复验
- 验收人：制作人
- 日期：2026-08-06（UAT-3 · 最终 focused re-UAT）
- 备注：**PASS — 制作人最终验收通过。** 独立复验：1011/1011 test、7/7 eval、UI fixture smoke 6/6、meeting E2E 17/17、飞书只读探针 ok。A1/A2 已修复。tasks **40/40** 有等价 E2E 事实依据（非伪造；UI 层 mode=controlled-ui-fixture 已明示）。**放行 Tester focused re-test**；story-done / gate-check / 归档仍待测试收尾后执行。  
- 证据：`evidence/producer-uat.md`、`evidence/producer-uat3-eval.json`、`evidence/grounding-meeting-e2e.json`、`evidence/grounding-ui-fixture-smoke.json`、`evidence/feishu-readonly-meeting-probe.json`、`evidence/screenshots/`
