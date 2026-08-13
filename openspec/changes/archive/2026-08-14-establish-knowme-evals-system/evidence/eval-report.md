# Hard Offline Gate

- Layer: L0
- Suite: hard-offline
- Baseline: v1
- Gate: blocking
- Passed: 10/10 (100.0%)
- Duration: 44ms
- Latency p50/p90: 1ms / 3ms

## Dimension Summary

| Dimension | Avg | Min | Max |
|---|---:|---:|---:|
| toolChoice | 0.600 | 0.000 | 1.000 |
| factFaithfulness | 1.000 | 1.000 | 1.000 |
| refusalWhenUnmet | 1.000 | 1.000 | 1.000 |
| contextContinuity | 1.000 | 1.000 | 1.000 |
| toolArgs | 1.000 | 1.000 | 1.000 |
| taskCompletion | 1.000 | 1.000 | 1.000 |
| formatUx | 1.000 | 1.000 | 1.000 |
| toolSuccessRate | 0.950 | 0.500 | 1.000 |
| latencyMs | 1.000 | 1.000 | 1.000 |
| recoveryPassRate | 1.000 | 1.000 | 1.000 |
| ungroundedClaimRate | 1.000 | 1.000 | 1.000 |

## Scenarios

### delegate-evidence-aggregation — PASS

Metrics: latency=21ms, rounds=2, toolCalls=1

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### feishu-meeting-pick-2-happy — PASS

Metrics: latency=3ms, rounds=2, toolCalls=1

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### feishu-meeting-pick-2-no-tool — PASS

Metrics: latency=1ms, rounds=1, toolCalls=0

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

Taxonomy: missing_tool

Fail reasons: toolChoice: 0 < 1 (hard)

### governance-refusal-ungrounded — PASS

Metrics: latency=0ms, rounds=1, toolCalls=0

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

Taxonomy: missing_tool

Fail reasons: toolChoice: 0 < 1 (hard)

### numeric-deixis-multiturn — PASS

Metrics: latency=1ms, rounds=1, toolCalls=0

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### recovery-after-tool-error — PASS

Metrics: latency=2ms, rounds=3, toolCalls=2

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 0.5 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### skill-required-tools-unmet — PASS

Metrics: latency=1ms, rounds=1, toolCalls=0

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

Taxonomy: missing_tool

Fail reasons: toolChoice: 0 < 1 (hard)

### task-switch-stale-facts — PASS

Metrics: latency=1ms, rounds=1, toolCalls=0

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### thin-body-title-only — PASS

Metrics: latency=1ms, rounds=2, toolCalls=1

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

### tool-budget-conflict — PASS

Metrics: latency=2ms, rounds=1, toolCalls=1

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |
| toolSuccessRate | 1 |
| latencyMs | 1 |
| recoveryPassRate | 1 |
| ungroundedClaimRate | 1 |

Taxonomy: missing_tool

Fail reasons: toolChoice: 0 < 1 (hard)
