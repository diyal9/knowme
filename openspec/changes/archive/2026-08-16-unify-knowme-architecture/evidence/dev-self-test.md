# 开发自测 — unify-knowme-architecture

- `npm test` 通过
- `npm run test:renderer` 41 passed
- `npm run typecheck:renderer` 通过
- `npm run lint`：architecture ok / lint ok
- 便签/list Vite 入口已移除；`tests/fixtures/legacy-pages` 已删除
- Zustand 切片：`store.ts` 组合 `store-workbench` / `store-assistant` / `store-files-knowledge` / `store-studio`
- 设置窗：`features/settings/SettingsSurface.tsx`（模型 / 内容源 / 连接器）
- 主进程：`src/main/load-renderer.js` + `src/main/tray.js`；preload 入口 `src/preload.js` → `src/preload/index.js`
- 本阶段按 design：`package.json` main 仍为 CJS `src/main.js`
