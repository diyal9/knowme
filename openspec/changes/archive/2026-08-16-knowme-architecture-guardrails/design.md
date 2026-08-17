## Context

Change `unify-knowme-architecture` 已拆 store、退役便签黄金页，并接入架构检查。本 change 把规范写成可重复执法的门禁。

## Goals / Non-Goals

**Goals:** 文档 + Rule + lint 脚本与质量门禁一致。  
**Non-Goals:** 把主进程全部迁到 TypeScript。

## Decisions

1. 人读规范唯一入口是 `docs/architecture.md`；`AGENTS.md` 只导航。
2. `check-architecture.js` 由 `scripts/lint.js` spawn，失败即 lint 失败。
3. TS/TSX 400 行；`src/lib` 必须是 `.ts`；禁止 `src/*.html` 页面壳（`attention-toast.html` 除外）；禁止 `tests/fixtures/legacy-pages`；domain 禁止 window/Electron。存量 lib 超限见 `scripts/architecture-lib-oversize.json`，只许缩小。
4. 主进程入口仍为 CJS `src/main.js`；`src/lib` 经 `scripts/register-ts.js` 在运行时转译。

## Electron 边界

Renderer 只走 `window.api`；IPC 名字以 `src/shared/api.ts` 为源。

## Risks

| Risk | Mitigation |
|------|------------|
| 400 行误伤生成物 | 只扫 `src/**/*.{ts,tsx}`，排除 dist |
