# Design: quality-pass-token-and-hygiene

## Approach

仅改 CSS token 接线与死代码删除，不动 DOM/交互。

## Token mapping

| 旧值 | 新值 |
|------|------|
| `#34312d` primary btn | `var(--wb-accent)` |
| primary hover `#1c1917` | `#285f4e`（接近既有 studio hover） |
| review `#2f7d4a` | `var(--wb-success)` |
| review `#c27a1a` | `var(--wb-warning)` |
| review `#b42318` | `var(--wb-danger)` |
| studio `#2f7461` | `var(--wb-accent)` |
| missing `--wb-border` | alias → `var(--wb-line)` |

## Risk

- 流程详情弹窗 primary hover 原为炭黑加深；改为绿加深，视觉变化局部、符合工作台绿语义。
- `MOCK_CATALOG` 测试改为断言「无 mock catalog 常量」。
