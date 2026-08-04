# 开发自测报告

- 日期：2026-08-04
- Change：`consolidate-capability-hub-entry`
- OpenSpec strict validate：PASS
- 定向测试：PASS（capability Hub + workspace rail，8/8）
- `npm test`：PASS（885/885，151 suites，0 fail）
- `npm run lint`：PASS（lint ok / script-scope ok）
- IDE lint：PASS（无新增诊断）
- Electron 重启：PASS（`INFO system/app-start KnowMe 主进程启动`；仅既有开发态 CSP warning）

## UI 冒烟

- 工作台 rail 仅显示一个“能力：专家、技能与 MCP 连接器”按钮，原三个按钮已移除
- 点击单一入口后在原工作台上打开 Capability Hub，rail 按钮呈 active/pressed
- Hub 默认激活“专家”Tab
- 页内“技能”Tab 切换后显示技能分类与技能卡片
- 页内“MCP 连接器”Tab 切换正常，保持同一页面
- `?tab=experts|skills|connectors` 深链继续可用
- Esc/关闭消息与 Agent 会话保留逻辑未改

## 说明

浏览器静态预览中的 `onWorkspaceRefresh` 报错来自缺少 Electron preload bridge，不在真机 Electron 中出现，与本次 rail/Tab 变更无关。

## 结论

开发自测 **PASS**，可进入制作人体验验收。
