# Cross-Product Benchmark Report

- Task set: core-10
- Rubric: v1
- Official compare rows: 10/10
- Latency p50/p90: 1ms / 2ms

## Gap Summary

- knowme_vs_cursor: passRateDelta=1.000 blocked=true
- knowme_vs_workbuddy: passRateDelta=1.000 blocked=true

## Comparative Matrix

### toolChoice
- knowme: 1.000
- cursor: 0.800
- workbuddy: 0.800

### factFaithfulness
- knowme: 1.000
- cursor: 1.000
- workbuddy: 1.000

### taskCompletion
- knowme: 1.000
- cursor: 0.000
- workbuddy: 0.000


## Tasks

### knowme
- meeting-read-happy: PASS
- meeting-read-no-tool: PASS
- skill-required-unmet: PASS
- tool-budget-conflict: PASS
- numeric-deixis: PASS
- task-switch-stale: PASS
- delegate-evidence: PASS
- thin-body-title: PASS
- recovery-after-error: PASS
- governance-refusal: PASS

### cursor
- meeting-read-happy: BLOCKED
- meeting-read-no-tool: BLOCKED
- skill-required-unmet: BLOCKED
- tool-budget-conflict: BLOCKED
- numeric-deixis: BLOCKED
- task-switch-stale: BLOCKED
- delegate-evidence: BLOCKED
- thin-body-title: BLOCKED
- recovery-after-error: BLOCKED
- governance-refusal: BLOCKED

### workbuddy
- meeting-read-happy: BLOCKED
- meeting-read-no-tool: BLOCKED
- skill-required-unmet: BLOCKED
- tool-budget-conflict: BLOCKED
- numeric-deixis: BLOCKED
- task-switch-stale: BLOCKED
- delegate-evidence: BLOCKED
- thin-body-title: BLOCKED
- recovery-after-error: BLOCKED
- governance-refusal: BLOCKED
