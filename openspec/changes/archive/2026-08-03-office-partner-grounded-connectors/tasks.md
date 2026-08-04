# Tasks: office-partner-grounded-connectors

- [x] 1. 新建 `office-partner-grounded-connectors` change 工件，明确飞书工具门控、GitHub/网页内容源与专业润色链路的行为规格
- [x] 2. 梳理并修正飞书连接器状态判断与提示文案，区分未启用、未授权、allowlist 未放行、未读取正文四类状态
- [x] 3. 扩展 `src/lib/connectors/*` 与相关主进程逻辑，确保工具投影时能给出更准确的“为什么当前看不到工具”信息
- [x] 4. 为内容源模型新增 `github` 类型，支持仓库 URL 拉取、本地缓存、内容树浏览、文件读取与同步
- [x] 5. 为内容源模型新增 `web` 类型，支持网页抓取、正文抽取、本地缓存与作为 active source 的只读检索
- [x] 6. 更新 `src/workspace.js` / 设置与工作台 UI，使 GitHub / 网页内容源可添加、切换、浏览并有清晰文案
- [x] 7. 扩展写作办公搭档上下文组装，让润色改写优先结合飞书正文、本地知识库、远程 RAG 与 active source 资料
- [x] 8. 调整写作提示与接地逻辑，使“润色改写”体现专业性、事实边界和资料引用路径
- [x] 9. 补充测试，覆盖飞书工具状态分支、GitHub/网页内容源、润色链路上下文增强与回归行为
- [x] 10. 执行 `npm test`、`npm run lint`，补写开发自测证据
- [x] 11. 飞书 API 瞬时故障（Internal error / Please retry）不得把原始 JSON/`log_id` 甩给用户；失败 `text` 与 `buildToolFailureHint` 须友好化，读工具路径应自动重试瞬时错误
