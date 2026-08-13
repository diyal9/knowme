# Dev self-test: polish-studio-canvas-node-summary-icons

Date: 2026-08-13

## Commands

- `node --test tests/workbench-studio-canvas.test.js` — pass (17)
- `npm test` — pass (1809)
- `npm run lint` — pass

## Checks

- [x] Canvas node headers use `data-icon` via `studioKindIcon` (aligned with palette)
- [x] Long IO lists summarize with「等 N 项」; no ` · string` type suffix on cards
- [x] Agent placeholder「本环节输入」hidden on canvas; expert + goal kept
- [x] Header height budget + gate width avoid hard clipping
- [x] Titles/rows expose full text via `title` attribute

## Manual (recommended)

Open 编排工作流 professional canvas and confirm icons match left palette; long end-node outputs show overflow hint without bottom crop.
