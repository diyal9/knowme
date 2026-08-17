# QA Plan: split-lib-god-files-by-domain

## Smoke Scope（必填）

- [ ] `npm run lint` 含 architecture ok
- [ ] `npm test` 绿
- [ ] 助理发送仍走主路径（不改语义）
- [ ] 能力中心列表仍能打开（catalog require 路径未断）

## Regression Scope

- [ ] 网页抓取 / 内容源网页仍受 SSRF 限制（web-fetch 导出未丢）
- [ ] 工作台启动向导步骤枚举仍在（launch-model）

## Anti-pattern Checks

- [ ] 未用 vm concat 规避 400 行
- [ ] 未新增白名单条目
