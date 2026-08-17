# 开发自测报告

- 日期：2026-08-16
- Change：extract-main-context-ipc-deps
- 结构测试（split-entry / architecture-sweep / assistant-output-style）：PASS
- npm run lint: PASS
- npm run typecheck:renderer: PASS
- 手动冒烟: 未拉起 Electron；请 `npm start` 看工作台与托盘
- 备注：已删除 `scope.ts` / `ipc-bind.ts`；组合根持有 `ctx`
