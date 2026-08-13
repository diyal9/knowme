# strengthen-workbench-tool-surface 回顾

- 日期：2026-08-06
- 结果：开发自测、制作人验收、正式 QA 与最终 Story 门禁通过；40/40 tasks 完成。

## 有效做法

- 以统一 Tool Contract Registry 驱动 Agent 投影、Hub 展示、执行 envelope 与审计，避免每类工具各自定义风险和结果语义。
- 文件、飞书及高风险操作统一采用 draft → preview → approve/reject → apply → audit，fake 测试明确断言未批准时零外部写。
- 将文件、进程、artifact、MCP/browser 与子 Agent 编排串成闭环 eval，比单纯统计工具数量更能证明功能可交付。
- 保留 `KNOWME_TOOL_SURFACE=legacy` 回退路径，使大范围工具面升级可以渐进启用。

## 测试经验

- 全仓库回归为 1069/1069；本 Story 另有 65 项工具专项、24 项反模式、7 项 IPC roundtrip 及 Electron/Node 验收。
- 真实凭据场景必须明确标记 SKIP，不可用 fake 结果替代：飞书真实 apply、Playwright MCP、live Agent 对话和子 Agent live delegate。
- QA 发现的非阻塞 UX 问题应独立跟进：审批卡 target path/connector 摘要、回滚 UI、mkdir 风险说明、Hub Playwright 安装指引点击流。

## 规格同步经验

- 归档前逐一比对 15 个 delta specs 与主 specs，按 requirement/scenario 语义增量合并，保留主规格既有内容。
- 同步新增 7 个主规格，并更新 8 个既有主规格；15/15 主规格均通过 OpenSpec strict validation。
- 严格验证暴露了两个既有主规格结构问题：`agent-thinking-timeline` Purpose 过短、`content-sources` 缺 Purpose；补充语义准确的 Purpose 后通过。

## 后续

- 将真实环境 SKIP 保留为可选 UAT，不影响本 Story DONE。
- 本回顾仅写入 working memory；未执行 `kb-ingest`，也未升格团队 OKF。
