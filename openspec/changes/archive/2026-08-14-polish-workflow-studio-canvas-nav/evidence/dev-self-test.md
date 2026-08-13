# Dev self-test — polish-workflow-studio-canvas-nav

Date: 2026-08-12

## Automated

- `node --test tests/workbench-studio-canvas.test.js` — pass (10/10), including vertical/horizontal side routing

## Manual checklist (for producer)

- [ ] Wheel zooms toward cursor; toolbar +/- / % / fit works
- [ ] Drag empty canvas / middle button / Space+drag pans
- [ ] Nodes show top+bottom ports (opacity full on hover)
- [ ] Vertical cascade uses smooth curves bottom→top, not stair steps
- [ ] Node drag updates edges live; start/end movable
