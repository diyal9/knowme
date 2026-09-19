# Test Report

## 自动化结果

- Node 全量测试：1865 项，1814 通过、51 跳过、0 失败。
- Brain 专项：19 项全部通过，覆盖观察、Proposal、Memory bridge、编辑确认、拒绝抑制、图谱刷新与撤销。
- Personal Agent 专项：明确教学在产品运行时进入待确认，不再直接写 global memory。
- Renderer 知识页：15 项全部通过，覆盖分类、解释、编辑确认、撤销与筛选。
- `npm run lint`：通过。
- `npm run typecheck:lib`：通过。
- `npm run typecheck:renderer`：通过。
- `npx openspec validate activate-brain-cognition-loop --strict`：通过。
- `git diff --check`：通过。

## Playwright 实际界面

- 使用 Chromium 在 1280×800 下运行 `scripts/brain-cognition-smoke.py`。
- 验证待确认提案可解释、可编辑，确认后修改内容进入 Brain 图谱。
- 验证最近成长显示本次变更，撤销后图谱节点消失。
- 浏览器 `pageerror` 为 0。

## 全量门禁结果

`npm run check` 已完整执行，Node 与 lint 通过；Renderer 为 69 个文件中 68 个通过、408 项中 407 项通过。

唯一失败是既有跨页面 CSS 契约：

```text
src/renderer/app/surface-css-contract.spec.ts
src/renderer/styles/capability-hub.css 包含 10px / 11px 字号
```

该 Capability Hub 样式文件存在与本次 Brain 认知闭环无关的用户未提交改动，因此未在本变更中修改或回滚。本次知识页及认知闭环测试均通过。
