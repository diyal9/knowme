## Why

通用助手点「查文档/知识库」必然失败，界面只显示「未能收到完整答复，请重试。」。真机复现拿到的主进程错误是 `所需工具不可用：feishu.doc_kb_suggest`。

根因是工具面装配把额外工具**静默截断**：`agent-tools.normalizeExtraDefinitions()` 硬截断到 32 个，而连接器（飞书）工具在 registry 里最后注册、排在末尾。实测工具面 36 个（4 内置 + 32 extras），只剩 `feishu.meeting_candidates / meeting_read / related_chats / today_priority`，被丢掉的包括 `feishu.doc_kb_suggest`、`feishu.search_docs`、`feishu.read_doc`、`feishu.list_wiki_spaces / list_wiki_nodes / get_wiki_node`、`feishu.draft_minute_permission`，以及 `update_plan` 和技能工具。

连带两个放大故障的问题：

- 渲染层在 Output Protocol v2 下用通用文案覆盖了 main 返回的可执行错误，用户与开发都看不到原因
- 该前置失败路径不收敛 Run 终态（`agent-runs/<runId>/state.json` 停在 `running`）

## What Changes

- 工具面投影 MUST 按优先级选择：taskFrame/技能契约声明的必需工具与连接器工具优先于编排/子 Run 类工具
- 超出投影预算时 MUST 记录 warn 级日志并给出被裁工具名，MUST NOT 静默丢弃
- 投影预算 MUST 覆盖当前完整 v1 工具面 + 已启用连接器工具（提高上限并保留裁剪策略作为兜底）
- v2 助手气泡在 Run 失败且无正文时 MUST 展示 main 返回的可执行错误文案
- 工具不可用等前置校验失败 MUST 把 Run 收敛为终态（failed）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-tool-execution`：新增工具面投影预算与优先级要求
- `agent-chat-ux`：失败气泡展示可执行错误文案
- `agent-run`：前置校验失败收敛终态

## Impact

- 代码：`src/lib/agent-tools.js`、`src/lib/tool-contract-registry.js`、`src/lib/tool-surface-builder.js`、`src/main.js`、`src/workspace-agent.js`
- 体验：飞书文档/知识库/搜索/妙记权限申请等工具恢复可用；失败时给出可操作提示
- 无 IPC 协议、存储结构与依赖变更

## 目标用户

在通用助手与工作台里用飞书文档、知识库、会议纪要办公的 C 端用户。

## 验收标准

1. 通用助手点「查文档/知识库」能真实调用 `feishu.doc_kb_suggest` 并输出个人文件夹 / 知识库空间 / 记忆推荐 / 最近编辑 / 最近阅读分区
2. 已启用连接器的全部飞书工具在工具面内可见（不再被截断）
3. 投影超预算时日志出现被裁工具名的 warn 记录
4. Run 前置校验失败时，气泡显示可执行错误文案，Run 状态为终态
5. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改飞书 OAuth / scope 增量授权流程
- 不改 connector allowlist 的默认集合与设置页交互
- 不做工具面的语义化按需检索（本轮只做确定性优先级 + 预算）
