# Conversation Eval Report

- Suite: tool-surface
- Baseline: v1
- Passed: 7/7
- Duration: 13ms

## Scenarios

### feishu-meeting-pick-2-happy — PASS

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

### feishu-meeting-pick-2-no-tool — PASS

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

Fail reasons: toolChoice: 0 < 1

### numeric-deixis-multiturn — PASS

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

### skill-required-tools-unmet — PASS

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

Fail reasons: toolChoice: 0 < 1

### task-switch-stale-facts — PASS

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

### thin-body-title-only — PASS

| Dimension | Score |
|---|---|
| toolChoice | 1 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

### tool-budget-conflict — PASS

| Dimension | Score |
|---|---|
| toolChoice | 0 |
| factFaithfulness | 1 |
| refusalWhenUnmet | 1 |
| contextContinuity | 1 |
| toolArgs | 1 |
| taskCompletion | 1 |
| formatUx | 1 |

Fail reasons: toolChoice: 0 < 1
