# Dev self-test: tidy-daemon-node-progress

## Date

2026-08-12

## Checks

- [x] `node --test tests/workbench-task-projection.test.js` — 6/6 pass
- [x] `npm run lint` — ok
- [x] Static: `workbench.js` renders `outputLabel` + `wb-daemon-review-step-output`
- [x] CSS: ellipsis on step meta/output lines

## Notes

- Projection `meta` = 类型 · 执行者；产出短名为 basename（悬停看全路径）
- 需重启 Electron 后打开管线审阅「步骤」Tab 目视确认
