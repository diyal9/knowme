# Dev self-test: polish-daemon-artifacts-folder

## Commands

- `node --test tests/workbench-daemon-review.test.js` — pass (7)
- `npm run lint` — pass
- `npm test` — 1726/1727；偶发 `workbench-context-store` EPERM rename（与本次无关，重跑确认）

## Notes

- 制品空态：`artifactEmptyState` + 图标面板 +「查看步骤」
- 有文件：图标 / 名 / 尺寸元信息 / 操作
- 空态不再显示「点击预览」tip
