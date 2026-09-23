# 规格基线验证

日期：2026-09-22。

## 已执行

- `node .cursor/scripts/harness.js preflight --json`：通过，项目结构与基础文件完整。
- `openspec validate converge-knowme-agent-runtime-contracts --strict`：通过。
- `openspec show converge-knowme-agent-runtime-contracts --json`：正确识别 17 条 delta requirement。
- `git diff --check -- openspec/changes/converge-knowme-agent-runtime-contracts`：通过。
- `node .cursor/scripts/harness.js gate --json --change converge-knowme-agent-runtime-contracts`：执行完成；Node tests、lint、renderer typecheck、lib typecheck 通过，Renderer suite 有 1 个既有工作区失败。
- `npm run test:renderer -- --run src/domain/agent-v2-runtime.spec.ts src/domain/expert-collab-feed.spec.ts`：通过，15/15。
- `npm run typecheck:renderer`：通过。
- `npm test`：通过，3613 passed、0 failed（51 skipped）。
- Review follow-up slice：V2 reducer 异常路径 fail-closed；持久化 V2 answer 恢复 `v2AnswerCommitted`；子 Run 返回 duplicate/late/frozen decision；新增 malformed-state 与 reload canonical answer 回归测试。

## 既有门禁失败

`src/renderer/app/surface-css-contract.spec.ts` 期望 `.hub-nav .hub-search-wrap` 包含 `flex: 0 1 214px` 和 `max-width: 214px`，当前工作区 CSS 不满足。该测试与 capability hub CSS 在本 change 创建前的 `git status` 中已被修改；本 change 仅新增 OpenSpec 文档，没有修改 Renderer 或 CSS。

## 全局健康

`npm run openspec:health` 返回非零：活跃 change 22 个，其他既有 change 缺 QA、code review、evidence 或 acceptance。本 change 自身未被列入缺项。

## 边界

此记录现在同时包含第一批运行时切片的定向与全量 Node 证据；尚未完成的上下文隔离、专家计划结构化协议、持久化恢复与 Electron 验收仍需后续切片补齐。
