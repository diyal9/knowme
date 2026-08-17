# 开发自测 — boost-renderer-runtime-perf

- 日期：2026-08-18
- Change：boost-renderer-runtime-perf

## 门禁

| 检查 | 结果 |
|------|------|
| npm run lint | PASS |
| npm test | PASS（全量） |
| test:renderer assistant + shell-rail | PASS（settings 改为 findBy 等 lazy） |

## 实现核对

- [x] WorkspaceApp 仅壳 CSS；workbench/hub/run/shelf/secondary-dialog 按面 `ensureSurfaceCss`
- [x] Composer 跳过 streaming 文本估算 historyTokens；@ 时再 `loadFileCatalog`
- [x] AssistantPane 去首屏 fileCatalog；followUp/structuredPick `useCallback`
- [x] liveNow 本机默认 500ms；telemetry 2000ms
- [x] applyStreamEvent rAF/32ms 合并；detach/begin 强制 flush

## 手动

- 需 `npm start` 重启验证冷启动与流式体感（主进程/preload 变更）
