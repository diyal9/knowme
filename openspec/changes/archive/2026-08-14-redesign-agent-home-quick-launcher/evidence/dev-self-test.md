# 开发自测报告

- 日期：2026-08-06
- Change：`redesign-agent-home-quick-launcher`
- OpenSpec strict validate：PASS
- `npm test`：PASS（1187/1187）
- `npm run lint`：PASS（lint ok；script-scope ok）
- 定向测试：PASS（68/68）
- Electron 真机冒烟：PASS（9/9，renderer console error 0）

## 覆盖行为

- game-studio 首页固定四张推荐任务卡：文档/知识库、会议总结、相关聊天、今日优先级。
- “需求梳理”以独立“启动工作流”入口展示。
- Ctrl+K 打开命令面板并自动聚焦搜索框。
- 关键词即时过滤；无结果显示空状态。
- 搜索过程不修改 Composer 草稿。
- Escape 关闭面板并恢复 Composer 焦点。
- 动态任务合并、未匹配分组与四卡分区纯函数均有单测。

## 证据

- `electron-smoke.json`
- `screenshots/home-four-cards.png`
- `screenshots/command-search.png`

## 备注

首次完整测试发现一条旧断言仍要求工作台显示“快捷大类”静态标签；已将该测试更新为工作台搜索式命令面板契约，窄编辑器原有紧凑菜单断言继续保留。随后完整测试全绿。
