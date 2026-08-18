# Dev self-test — v0.4.0 closeout

日期：2026-08-18（干净工作树复核）

## 硬项

- [x] `npm run check` 全绿（unit 1615 / renderer 268）
- [x] `tests/smoke.test.js` renderer CSS minify 零 syntax warning
- [x] `npm run renderer:build` 成功且零 CSS 语法警告
- [x] ContentView 新增 source 切换用例 9/9 PASS
- [x] main-llm-bridge `options.all` 数组/标量 + `http.request` 集成测试 PASS
- [x] Electron core-path smoke 连续两轮 11/11 PASS

## 规格一致性

- [x] `openspec/specs/agent-chat-ux` 不再要求气泡「应用到文件」
- [x] `openspec/specs/agent-run` 写入走产物卡
- [x] `assistant.spec.tsx` 仍断言无「应用到文件」

## 已知限制（诚实）

- 薄表面见 BACKLOG，非 v0.4.0 欠账
- 长文首屏 profiler 未测毫秒级卡顿
- 真机 LLM 需用户 API Key，smoke 种子不打真实 LLM
