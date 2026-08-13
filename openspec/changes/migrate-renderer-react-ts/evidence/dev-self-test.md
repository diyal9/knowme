# Dev self-test — migrate-renderer-react-ts

Date: 2026-08-14  
Branch: `refactor/renderer-react-ts`  
Baseline: `f6ad048`

## Commands

```bash
npm run typecheck:renderer   # pass
npm run renderer:build       # pass (dist/renderer + legacy copy)
npm test                     # see gate
npm run lint                 # see gate
openspec validate migrate-renderer-react-ts  # pass
```

## Dual entry

- Default / `KNOWME_RENDERER=legacy` → `workspace.html`（产品基线）
- `KNOWME_RENDERER=vite` + `npm run renderer:dev` + `electron . --dev` → Vite React 入口 + LegacyHost 挂载同等 DOM/脚本

## Surfaces

见 `src/renderer/workspace/surfaces/registry.ts`：当前均为 `hosted`（产品对等优先），React 壳负责启动与模式 telemetry。

## Notes

- 打包：`prebuild` 会跑 `vite build`；`electron-builder.yml` 包含 `dist/renderer/**/*`
- 回滚：不设环境变量或 `KNOWME_RENDERER=legacy`
