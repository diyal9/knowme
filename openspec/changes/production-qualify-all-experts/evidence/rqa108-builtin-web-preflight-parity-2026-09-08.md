# RQA108：内置网页工具与专家任务预检一致性

日期：2026-09-08

## 问题

研究分析师的公开网络路线声明了 `search_web` / `fetch_web_page`，正常 Agent 运行时会构建这两个宿主内置工具，但专家任务启动前的 `preflightExpertTools` 没有把它们登记到预检 Registry。预检因此把它们误判为连接器工具，在没有连接器的研究专家上返回“联合工具面未提供必需工具”，任务无法进入真实执行。

## 修复

- 预检层复用 `agent-web-tools.buildWebTools()` 的正式定义。
- 将网页搜索和网页读取加入与计算、能力导入相同的内置工具集合。
- 保留原有 allowlist、denylist、专家工具边界和连接器投影规则；没有放宽任何授权。
- 研究公开网络路线仍必须在真实运行时产生两项成功工具回执，才能提升为生产就绪；本修复只解决“启动前误阻断”。

## 验证

- `tests/expert-task-tool-preflight.test.js`：63/63 通过。
- 新增场景：使用真实 `research-analyst` 权限合同时，无连接器也能通过内置网页路线预检；空 allowlist 仍会拒绝。
- 原有连接器 union、权限拒绝、缺失投影、图片 Provider 别名和冲突归属场景保持通过。
- `npm run check`：后端 3507 项，3456 通过、51 跳过、0 失败；Renderer 86 文件 / 620 项通过；lint、typecheck 通过。

## 生产边界

当前用户数据中的条件路线仍未取得真实 Provider/联网执行回执，因此 `executionReady=false`、`productionReady=false` 仍然正确。不能用本地夹具或本次预检修复替代真实研究内容质量评审。
