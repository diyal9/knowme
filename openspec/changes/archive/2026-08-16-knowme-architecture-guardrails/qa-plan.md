# QA Plan — knowme-architecture-guardrails

## Smoke Scope

- [x] `npm run lint` 绿（含 architecture ok）
- [x] 无 `tests/fixtures/legacy-pages`
- [ ] 制作人：确认文档与 Rule 指向同一套约束（不跑产品路径）

## 反模式

- 再引入 `src/foo.html` 页面控制器
- 单 TS 文件超过 400 行合入
