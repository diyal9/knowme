# 开发自测报告

- 日期：2026-08-07
- Change：`enable-grounded-realtime-research`
- 开发结论：PASS

## 自动化

- `npm test`：PASS，1408/1408，0 fail（最终运行 5.92s）
- `npm run lint`：PASS，`lint ok`、`script-scope ok`
- `openspec validate enable-grounded-realtime-research --strict`：PASS
- 聚焦回归：PASS，意图、路由、RSS provider、Tool Registry、提示词与 OutputGate 均覆盖
- `git diff --check`：PASS

## 网络与安全

- 默认 provider 实网探针：PASS
  - 输入：`今天 AI 资讯`
  - 归一化查询：`AI`
  - provider：`bing-rss`
  - 最近 1 天返回 3 条，首条 URL 已从 Bing redirect 解包为原始站点
- 网络单测全部 mock：超时、HTTP 错误、无效响应、无结果、恶意/私网 URL、去重、时间窗口与结果上限
- 搜索摘要在工具输出中明确标注为发现线索，详细事实仍要求 `fetch_web_page`

## Electron 冒烟

- 命令：`node openspec/changes/enable-grounded-realtime-research/evidence/realtime-research-electron-smoke.js`
- 结果：PASS，8/8，console error 0
- 覆盖：同类提问、网络搜索时间线、网页读取时间线、核验依据、2 条来源链接、发布时间/检索时间、无单项飞书选择
- 报告：`evidence/realtime-research-electron-smoke.json`
- 截图：`evidence/screenshots/realtime-research-timeline.png`
- 说明：该 Electron 用例使用正式 Renderer/IPC/Output Protocol 的确定性 fixture 验证 UI 闭环；真实 provider 由独立实网探针验证，未把 fixture 表述为真实 LLM E2E。

## 运行态

- 已重启开发态 KnowMe。
- 当前可见 Electron 进程：4 个（主进程及子进程）。
- 启动日志：`INFO system/app-start KnowMe 主进程启动`

## 已修问题

- 初次全量测试因测试调用了不存在的 `registry.register` 失败；改为真实 API `registry.registerTool` 后全量通过。
- 初次实网探针因中文时效词导致 Bing 本地化 RSS 无命中；新增新闻查询归一化、`mkt=en-US`/freshness 参数和 Bing 原文 URL 解包后实网通过。
- 来源折叠区曾直接显示浏览器默认三角、列表圆点和缩进；现已统一为产品内展开箭头、中文计数括号、状态色、间距及无项目符号列表，并新增 10/10 聚焦 UI 回归。
