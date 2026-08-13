# Dev Self-Test: unify-workspace-chrome-surface

- Change: `unify-workspace-chrome-surface`
- Date: 2026-08-12
- Result: PASS（壳层契约 + lint + Electron 启动）

## Checks

| Item | Result |
|------|--------|
| 顶栏 `.app-chrome-brand` + KnowMe 文案 | PASS（代码/契约） |
| `--wb-bg: var(--bg-card)`，去掉工作台灰径向渐变 | PASS |
| `--content-island-radius-tl` 用于 `.main` 与 center-surface | PASS |
| 覆盖层 / 专家库外层底色对齐白底 | PASS |
| `npm run lint` | PASS |
| Chrome 契约断言 | PASS |
| `npm start` 重启 | PASS（`app-start`，无 uncaught） |

## Notes

- 全量 `npm test` 另有 2 个既有失败（`wbStudioAddAgent` / studio palette），与本 change 无关，属 `streamline-studio-palette-expert-picker` 契约漂移。
- 请人工确认：助理 ↔ 工作台切换背景一致；顶栏品牌可见且可拖窗；知识网覆盖层左上圆角与主岛一致。
- 圆角残影修复 v1：rail 分隔改为 inset shadow；`.main` / center-surface 使用 `clip-path` 圆角裁剪，去掉覆盖层左边框。
- 圆角残影修复 v2：去掉 clip-path 与 inset 阴影双边缘；嵌入设置页画布改为白底与助理一致。
- 文件栏展开：圆角改挂在 `.sidebar`；收起时才挂 `.main`，避免栏缝尖角波及助理/工作台。
