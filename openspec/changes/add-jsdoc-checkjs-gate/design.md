## Context

无 bundler；Electron 直接加载 `src/**/*.js`。类型层必须零运行时成本。

## Goals / Non-Goals

**Goals:**
- `jsconfig.json` + `tsc --noEmit` 脚本
- advisory 接入 harness
- 示范性 JSDoc（1～2 个 lib 导出）

**Non-Goals:**
- 不上 TypeScript 源码迁移
- 本 Story 不把 typecheck 设为 gate 硬项
- 不全库消除 checkJs 报错

## Decisions

1. 首期 `jsconfig.json` 用 `files` 白名单（先收 `workbench-daemon-errors.js`），避免全库存量 checkJs 噪声淹没信号；后续按模块扩白名单
2. `typescript` 写入 `devDependencies`，脚本调用本地 `node_modules/typescript/bin/tsc`
3. harness：advisory 报告 error 数；`TYPECHECK_STRICT=1` 才非零退出

## Risks / Trade-offs

- 白名单过窄 → 覆盖不足；通过后续 Story 扩 `files`/`include`
- 存量噪声 → 正是首期收窄的原因
