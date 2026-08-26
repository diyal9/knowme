# Design

## Architecture
连接器包描述可分发能力；连接器实例保存本机非敏感配置和密钥引用；MCP Host 负责传输；Tool Runtime 负责发现后的契约投影、允许列表、风险审批与回执；Agent / Skill / Workflow 只声明依赖和工具引用，不直接持有连接信息。

主进程是唯一可读取密钥和建立外部进程/网络连接的边界。preload 只暴露脱敏视图和有限命令，渲染层不能读取解密值。工作流启动先经过依赖解析，再进入现有 Team Workflow Runner，避免建立第二套执行器。

## Connector manifest
连接器清单在既有 Capability Manifest v3 之上保留 `connector` 元数据：传输类型、配置字段、密钥槽、健康检查、工具策略与能力标签。旧 `type` / `mcp` 字段继续读取，写回时统一为受管结构。

工具策略按精确名称或 glob 匹配，定义风险、是否有副作用、是否审批、超时和展示说明。未命中策略的远程工具默认按网络副作用处理，不获得更低权限。

## Secrets
密钥单独存放在用户数据目录，值由 Electron `safeStorage` 加密。连接器 manifest、公开 API、工具回执和日志只出现槽位名及 `configured` 状态。系统加密不可用时禁止保存明文并返回可操作错误。

## Transports
- `stdio`：命令、参数、cwd、非敏感环境变量和密钥环境变量映射。
- `streamable-http`：JSON-RPC POST，支持会话头。
- `sse`：legacy MCP GET 事件流取得消息端点，再通过 POST 发送 JSON-RPC。

三者实现同一 session 接口：`initialize/listTools/callTool/health/close`。

## Dependency gate
依赖解析输出 `ready / missing / needs_configuration / disabled / offline`。必需依赖阻止启动；可选依赖只产生降级提示。PSD 工作流中 Photoshop 为必需，Creator 在 Widget 还原模式为必需、绝对布局模式为可选。

## Import safety
外部 `.cursor/mcp.json` 的 `env`、`headers` 和 URL 凭据不写入能力包。扫描器生成连接器实例草稿、必需密钥槽和 `needs_configuration` 状态。导入后由用户在能力中心补齐。

## Performance
连接器列表读取不主动建立 MCP 会话。工具发现和健康检查由用户操作或工作流预检按需触发，并设置超时；发现结果可短期缓存。关闭或更新实例时关闭旧会话，避免后台进程泄漏。

## Compatibility
`mcp-default`、飞书和旧 `connectors.json` 继续双写迁移。旧清单缺少 `connector` 元数据时由适配器生成默认 stdio 配置和保守工具策略。
