# Token guard evidence

- Script: `scripts/check-ui-accent-tokens.js`
- Test: `tests/ui-accent-tokens.test.js`（随 `npm test`）

## Rules

| 层 | Hex | 允许 |
|----|-----|------|
| 壳层 `--accent` | `#3d3a36` | Rail / 设置 primary |
| 工作台 `--wb-accent` | `#2f6f5e` | 工作台 / 货架 / Hub / Studio primary |
| 禁止 | `#2f6fed` | 错误蓝（typo） |

## Result

见本 Story 开发自测时段 `npm test` 中 `ui accent token guard` 用例。
