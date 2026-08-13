# Dev self-test — polish-daemon-review-ux

Date: 2026-08-12

## Checks

- [x] 审阅面：daemon 态去米色壳/卡套卡；底栏浅色
- [x] 底栏按钮：图标 + 两字（刷新 / 重跑 / 返回）
- [x] 步骤 Tab：进度条 + 竖向时间线；降级紧凑 callout
- [x] 变更 Tab：「代码工作区」打开右栏内嵌工作区（`/workspace/tree|blob`）；点 Tab 先切 UI 再轻量拉变更
- [x] `npm test` — 见门禁
- [x] `npm run lint` — ok

## Follow-up 2026-08-12

- 代码工作区改为嵌在 `#wbTaskDashboard` 内全屏层，不再用全窗 modal 遮挡左栏对话
- 变更 Tab：`light` 只拉 changes；乐观切换 + loading；列表上限 200

## Manual (after Electron restart)

1. 打开失败的 `team-run` 审阅面：底栏应为浅色，按钮为图标两字
2. 步骤：有节点时可见进度条与时间线；降级时仅 callout
3. 变更 → 代码工作区：弹窗可选仓、展开目录、预览文件
