# 视觉治理基线（2026-09-23）

命令：`node scripts/audit-renderer-visual-system.js --json`

## CI 声明级口径

| 指标 | 基线 | 目标 |
|---|---:|---:|
| CSS 文件 / 行数 | 24 / 24,474 | 按职责维护，不以文件数为 KPI |
| 消费层硬编码字体像素声明 | 1,878 | ≤ 50 |
| 字体令牌化占比 | 12.2% | ≥ 90% |
| 硬编码圆角声明 / 唯一值 | 1,022 / 41 | 常用唯一值 ≤ 6 |
| 非令牌阴影唯一值 | 208 | ≤ 10 |
| 硬编码间距声明 / 占比 | 4,308 / 80.6% | 占比 ≤ 15% |
| `!important` | 345 | ≤ 30，全部有例外说明 |

该口径逐条解析消费者 CSS，也统计同一行中的多条声明、`font` shorthand、feature 局部变量、定位间距与 fallback literal，因此比前期行级抽样更严格。它用于锁定 CI 非回退 ceiling；前期“533 字体 / 1,224 间距”等抽样数字仍可用于历史对照，但不再作为自动门禁分母。

## 最大债务域

- 字体：`workbench-layout.css`、`agent-chrome.css`、`knowledge-chrome.css`、`expert-workbench.css`。
- 间距：`workbench-layout.css`、`knowledge-chrome.css`、`expert-workbench.css`、`agent-chrome.css`。
- `!important`：`expert-workbench.css` 159 处，`workspace-chrome.css` 65 处。

每完成一个体验域迁移，将 `scripts/renderer-visual-budget.json` 下调到新的实测值；不得上调 ceiling 规避失败。
