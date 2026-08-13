# QA Plan: formalize-skill-catalog-coverage

## Smoke Scope

- [x] 启动应用后能力包：`game-studio`、`office-partner` 均为启用
- [x] 办公助理空状态可见「今日优先级」及飞书快捷入口
- [x] 能力中心可看到 `code-review`、`knowledge-steward`、`visual-brief-prompt`
- [x] 官方工作流卡片可启动，不报 skill 缺失

## 自动化

- `npm test` — PASS 1855/1855
- `npm run lint` — PASS

## 手动（可选）

1. 办公助理 → 空状态 → 点击「今日优先级」→ 应触发飞书授权或 Top3 输出
2. 能力包 → 禁用再启用 `office-partner` → `writing-polish` 仍可加载
