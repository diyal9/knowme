# Design: harden-engineering-gates

## 渲染测试

生产仍 `React.lazy`。Vitest 下 `import.meta.env.MODE === 'test'` 同步解析表面（Vite DCE，发行包无此分支）。非当前路由不挂工作台懒块。Suspense fallback 为 `km-surface-pending`；`renderApp` 等到其消失。

## 门禁

`npm run check` 串行硬项。`harness gate`：
- 硬：test、lint、test:renderer、typecheck:renderer（与 quality-gates.mdc 对齐；保留 typecheck:lib）
- 软：`--change` 或 `OPENSPEC_CHANGE`；未指定只汇总计数，不刷 40+ 条 WARN
- fail detail 截断，避免 JSON 几十万字符

## OpenSpec

`scripts/openspec-health.js` 统计 active / 缺 qa-plan / 缺 code-review。已完成工程 change 归档到 `archive/2026-08-18-*`。未完成 restore-* 留在 active，列入 BACKLOG。
