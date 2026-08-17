# Screenshots — align-production-ui-visual-parity

## Baseline 引用

Oracle 截图（勿改文件，仅对照）：

- `../../restore-game-studio-ui-parity/evidence/screenshots/baseline/baseline-assistant.png`
- `../../restore-game-studio-ui-parity/evidence/screenshots/baseline/baseline-workbench.png`
- `../../restore-game-studio-ui-parity/evidence/screenshots/baseline/baseline-shelf.png`

## Current

采集：

```bash
npm run renderer:build
node scripts/capture-production-ui-parity.js
```

产出目录：

- `assistant/current-assistant-empty.png`
- `workbench/current-taskhome.png` / `current-shelf.png`
- `settings-hub/current-hub.png` / `current-settings.png`
