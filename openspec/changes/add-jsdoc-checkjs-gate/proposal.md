## Why

前端无构建/类型层，IPC 与 `src/lib` 边界靠测试兜底。需要轻量 JSDoc + checkJs，在不上 TS/bundler 的前提下尽早抓住参数形状错误。

## What Changes

- 新增根级 `jsconfig.json`（`checkJs` + `allowJs`，先收紧 `src/lib` / `src/ipc`）
- 新增 `scripts/check-jsdoc.js`（调用 `npx --yes typescript@5 tsc -p jsconfig.json --noEmit`）
- `npm run typecheck`；`harness check/doctor` 以 **advisory** 报告（初期不 BLOCKING，避免存量噪声阻塞 Story）
- 对 2～3 个高频导出补最小 JSDoc typedef（示范，不全库标注）

## Capabilities

### New Capabilities

（无 — 工具链，`skip_specs: true`）

### Modified Capabilities

（无）

## Impact

- 开发依赖：按需 `npx typescript`（不强制写入 package.json 亦可，tasks 中二选一）
- 不改变运行时行为；不引入 bundler
