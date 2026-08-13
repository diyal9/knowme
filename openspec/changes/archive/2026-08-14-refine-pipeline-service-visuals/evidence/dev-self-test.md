# Dev self-test: refine-pipeline-service-visuals

## Changes
- `src/workbench-console.css`：管线服务操作台字号、控件、主 CTA、状态色对齐 `--wb-*` / 货架规范

## Checks
- [x] `npm test` — 1683/1683 pass
- [x] `npm run lint` — ok
- [x] Electron 已重启加载新样式

## Notes
纯 CSS；交互与校验逻辑未改。主 CTA 可用态为 `--wb-accent`，禁用为 muted 表面。
