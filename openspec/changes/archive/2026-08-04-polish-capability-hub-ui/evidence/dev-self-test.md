# 开发自测报告

- 日期：2026-08-04
- Change：`polish-capability-hub-ui`
- `npm test`：PASS（892/892）
- `npm run lint`：PASS（lint ok；script-scope ok）
- 定向测试：PASS（`tests/capability-hub.test.js` 4/4）
- Electron 启动：PASS（KnowMe 主进程正常启动）
- 浏览器控制台：PASS（0 error，0 warning）

## 手动冒烟

- 专家 / 技能 / MCP 连接器同页切换：PASS
- 搜索、分类、已安装筛选与清除筛选：PASS
- 能力卡片、精选卡片与详情抽屉：PASS
- 添加能力弹窗、来源切换与 Esc/关闭：PASS
- 1024×510 桌面布局：PASS
- 720×600 窄桌面布局：PASS，无横向溢出

## 视觉证据

- `screenshots/experts.png`
- `screenshots/skills.png`
- `screenshots/connectors.png`
- `screenshots/add-dialog.png`

## 备注

- 开发态 Electron 输出既有 Insecure Content-Security-Policy 警告；本次改动未新增运行时异常。
