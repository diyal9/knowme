# React screenshots

Captured 2026-08-15 from `dist/renderer` (Vite production build) via Playwright Chromium + local HTTP (`scripts/capture-restore-ui-parity.js`). Stub `window.api` so surfaces render without Electron.

These are **renderer chrome evidence**, not a substitute for `npm start` Electron 真机。

| React | Baseline (`f6ad048`) |
|-------|----------------------|
| `react-assistant.png` | `baseline-assistant.png` |
| `react-workbench.png` | `baseline-workbench.png` |
| `react-shelf.png` | `baseline-shelf.png` |
| `react-daemon.png` | `baseline-daemon.png` |
| `react-files.png` | （基线无独立文件栏导出） |
| `react-studio.png` | — |
| `react-hub.png` | — |
| `react-knowledge.png` | — |
| `react-settings-*.png` | — |
| `react-memory.png` | — |
| `react-log-viewer.png` | — |
| `electron-workbench-search.png` | Electron 冒烟（Vite dev + `--dev`） |
| `electron-studio.png` | — |
| `electron-automation-cron.png` | — |
| `electron-hub-add.png` | — |
| `electron-files.png` | — |

复采（静态 React）：`npm run renderer:build && node scripts/capture-restore-ui-parity.js`

Electron Defer 收口：`node openspec/changes/archive/2026-08-18-restore-game-studio-ui-parity/evidence/defer-closeout-electron-smoke.js`
