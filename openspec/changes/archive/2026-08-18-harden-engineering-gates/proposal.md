## Why

工程门禁、OpenSpec 工作流、开发体验是评分短板（11 / 12 / 10）。`harness gate` 的 `test:renderer` 红、软项扫 43 个活跃 change、开发验证要记 5 条命令。这三项不抬，总分无法从工程侧再涨。

## What Changes

- 统一硬门禁：`npm run check` = test + lint + test:renderer + typecheck:renderer
- harness 与 quality-gates 对齐；默认只扫当前 change 的软项
- 渲染层懒表面在 Vitest 下可测（不再因 Suspense fallback=null 假红）
- OpenSpec 健康脚本 + 已完成 change 归档，活跃 backlog 降噪

## Capabilities

### New Capabilities

- `engineering-gates`: 单命令门禁、当前 change 软项、openspec health

### Modified Capabilities

- （无产品运行时能力变更）

## Impact

- 开发日常命令、harness、renderer 测试、openspec/changes 活跃集合
- 非目标：不改助理/工作台产品交互；不强制归档仍有未勾选任务的 restore-* 线
