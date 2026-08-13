# 开发自测报告

- 日期：2026-08-07
- Change：`unify-knowledge-settings-tabs`
- 定向测试：PASS（17/17）
- `npm test`：PASS（1286/1286）
- `npm run lint`：PASS（lint ok；script-scope ok）
- OpenSpec：PASS（`openspec validate unify-knowledge-settings-tabs --strict`）
- IDE 诊断：PASS（修改文件无 lint error）
- Electron 冒烟：PASS（14/14，page error 0，console error 0）

## Electron 验证结果

- 知识库：显示“浏览 / 知识源 / 知识体检”扁平标签，默认浏览激活；来源列表与体检结果可直接切换。
- 设置：七个现有分类提升到外层顶栏，iframe 内重复标题栏隐藏。
- 状态同步：父级“助手模式”激活后，iframe 同步显示 `panel-assistant` 且 `aria-selected=true`。
- 最小尺寸：900×650 下标签不换行、允许横向滚动，关闭按钮距窗口右侧 18px。
- 运行时：page error 0，console error 0。

## 截图

- `screenshots/knowledge-browse-tabs.png`
- `screenshots/knowledge-sources-tab.png`
- `screenshots/knowledge-health-tab.png`
- `screenshots/settings-shell-tabs.png`
- `screenshots/settings-assistant-tab.png`
- `screenshots/settings-tabs-minimum.png`
