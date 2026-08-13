# Conversation Eval Fixtures

Versioned multi-turn scenarios for grounded agent runtime regression.

## Suites

| Layer | Suite ID | Gate |
|---|---|---|
| L0 | `hard-offline` | blocking (CI) |
| L1 | `self-e2e-controlled` | advisory (nightly) |
| L2 | `cross-product-benchmark` | advisory (weekly) |

See `baselines/v1-thresholds.json`, `baselines/v2-thresholds.json` and `scenarios/*.json`.
