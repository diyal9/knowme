# 开发自测报告

- 日期：2026-08-07
- Change：`polish-workbench-navigation-shell`
- 定向测试：PASS（助理短标签与办公助理入口回归 7/7）
- `npm test`：PASS（1286/1286）
- `npm run lint`：PASS（lint ok；script-scope ok）
- OpenSpec：PASS（`openspec validate polish-workbench-navigation-shell --strict`）
- IDE 诊断：PASS（修改文件无 lint error）
- Electron 冒烟：PASS（`electron-evidence.json` 全项通过）

## Electron 验证结果

- 默认尺寸：rail 宽度 120px，窗口壳层宽度保持不变，首页扁平标签激活正确。
- 助理入口：侧栏可见标签为“助理”，tooltip 与 `aria-label` 保留“办公助理”。
- 最小验证尺寸 900×650：主内容宽度 779.2px，无横向溢出。
- 工作流标签：点击后 `aria-selected=true`，激活下划线完成切换。
- 工作台/自动化：模块标题隐藏，页面标签与刷新操作保留。
- Capability Hub：rail 右缘与覆盖层左缘均为 120px；重复品牌标题隐藏；专家、技能、MCP 连接器已移除胶囊容器和实心激活块，以扁平文字与激活下划线呈现，切换后 `aria-selected` 正确同步。
- 知识库/设置：覆盖层重复模块标题隐藏，关闭操作与正文标题保留。
- 运行时错误：page error 0，console error 0。

## 截图

- `screenshots/workbench-navigation-default.png`
- `screenshots/workbench-navigation-minimum.png`
- `screenshots/workbench-flat-workflow-tab.png`
- `screenshots/capability-overlay-aligned.png`
- `screenshots/capability-flat-skills-tab.png`
- `screenshots/knowledge-without-duplicate-title.png`
- `screenshots/settings-without-duplicate-title.png`
