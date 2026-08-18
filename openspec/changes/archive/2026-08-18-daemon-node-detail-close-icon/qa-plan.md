# QA Plan: daemon-node-detail-close-icon

## Smoke Scope（必填）

- [ ] 打开 Daemon 审阅 → 步骤 → 点击微节点进入详情 → 右上角可见关闭图标，无「返回步骤」
- [ ] 点击关闭图标 → 回到步骤列表
- [ ] 再次进入另一节点详情 → 关闭仍正常

## Regression Scope

- 步骤进度条、详情字段列表、底栏刷新/重跑/返回
- 切换「制品」等 Tab 后回到步骤仍为列表态

## Anti-pattern Checks（交给测试）

- 关闭图标是否过小难点 / 与标题重叠
- 是否误关整个 Daemon 审阅窗（应仅关详情）
