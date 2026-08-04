# Design: office-partner-grounded-connectors

## 架构

本次变更沿用现有 Electron 主进程 + Renderer 工作台 + 连接器 runtime 架构，不新建并行系统。

1. `src/lib/connectors/*`
   - 负责飞书连接器状态探测、allowlist 投影、MCP 工具投影
   - 修正“工具不可见”和“未授权提示”边界
2. `src/lib/sources.js` + `src/lib/*-source.js`
   - 扩展现有内容源模型，新增 `github` 与 `web` 两种 source
   - 继续复用 active source、目录树、只读文件工具、路径安全校验
3. `src/main.js`
   - 暴露新增 source 的 IPC：add / sync / read / tree
   - 在构建 active source file tools 时兼容 GitHub 与网页 source
4. `src/workspace.js`
   - 内容源设置与侧栏展示新增 GitHub / 网页入口与文案
5. `src/workspace-agent.js` + `src/lib/writing-workflow.js`
   - 让润色改写优先引用飞书正文、知识库、RAG、active source 资料
   - 明确“专业润色”与普通改写的策略差异

## 进程边界

| 层 | 位置 | 责任 |
|----|------|------|
| Renderer | `src/workspace.js`, `src/workspace-agent.js` | 内容源入口、聊天交互、润色动作、审阅动作 |
| Shared browser logic | `src/lib/conversation-grounding.js`, `src/lib/writing-workflow.js` | 任务识别、润色策略、上下文说明 |
| Main / Node | `src/main.js` | IPC、内容源读写、工具注入、知识/RAG 查询 |
| Connector runtime | `src/lib/connectors/*`, `src/lib/mcp-host.js` | 飞书/MCP 状态、allowlist 投影、外部工具调用 |
| Source adapters | `src/lib/gitlab-source.js`, `src/lib/github-source.js`, `src/lib/web-source.js` | 拉取远端内容、缓存到 userData、安全读取 |

## 飞书工具门控修正

当前问题不是单一“没权限”，而是多个状态被压缩成了同一类阻断提示。

本次将显式拆分以下状态：

1. 连接器未启用：`enabled !== true`
2. 连接器启用但用户身份未就绪：`status.state === auth_required` 或 `userReady === false`
3. 连接器已启用，但 allowlist 未放行当前工具
4. 工具已可用，但当前轮次尚未读取正文，因此只能继续读取，不能直接总结

渲染层与模型提示都必须基于这四种状态输出不同恢复路径，避免“明明有工具却说没工具”。

## 新内容源设计

### GitHub Source

- 沿用 GitLab 的“本地工作副本缓存”思路
- 用户提供仓库 URL（可选 branch），主进程用 `git clone --depth 1` 拉到 `userData/repos/`
- source 类型为 `github`，继续复用 `listTree/readFile/grep/semantic_search`
- 默认只读，不提供 push / PR / issue 等远端写能力

### Web Source

- 用户提供网页 URL，主进程抓取 HTML 并抽取正文，缓存为本地 Markdown / text 文件
- source 类型为 `web`
- 树结构可简化为单节点文档或小型页面集合，但对 agent 暴露仍然表现为可读文件
- 不依赖登录态，不支持需要认证的网页

## 润色改写的专业化链路

润色改写不再只是“拿到用户文本就改”，而是优先走以下增强顺序：

1. 若用户给出飞书链接，先读取飞书正文
2. 若 active source 已有 GitHub / 网页 / 本地资料，允许通过文件工具补充上下文
3. 若是知识型问题或存在背景要求，触发 `search_knowledge`
4. 若启用了远程 RAG / MCP，则允许调用相应检索工具补充事实
5. 再执行润色改写，强调专业性、术语一致性、事实不扩写

## 风险与权衡

- GitHub 若走本地 clone，首次拉取会比 HTTP 单文件读取更重，但能最大程度复用现有内容源与文件工具
- 网页正文抽取若过于激进会丢格式，因此需要保留标题、列表、代码块等基本结构
- 润色链路接入更多资料后，必须严格控制“引用了哪些资料”和“哪些仍是未确认推断”，避免把检索片段误写成既定事实
