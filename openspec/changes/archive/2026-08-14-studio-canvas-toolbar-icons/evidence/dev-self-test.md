# Dev self-test: studio-canvas-toolbar-icons

Date: 2026-08-12

## Commands

- `npm test` → 1708/1708 pass
- `npm run lint` → ok

## Manual (code-level)

- Toolbar HTML: left `#wbStudioTools` + meta + `#wbStudioActions`
- Right actions iconified: toggle-mode / save / run with title+aria-label
- Left tools (pro canvas): auto-layout, align-left/top/center-h, fit
- Unit: `alignNodes`, `layoutPositions` in `tests/workbench-studio-canvas.test.js`

## Notes

Restart Electron / hard refresh renderer to see icon toolbar.
