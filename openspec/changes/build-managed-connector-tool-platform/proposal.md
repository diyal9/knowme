# Why
KnowMe 已能保存基础 MCP 配置并把工具投影给 Agent，但连接器仍缺少统一的实例配置、密钥托管、健康检查、逐工具策略和依赖门禁。结果是导入的 Agent / Skill / Workflow 虽然“看得见”，真正执行时却无法可靠发现和调用外部工具。

# What Changes
- 建立受管连接器包、连接器实例、工具投影、能力绑定和工具回执五类运行时对象。
- 能力中心支持连接器安装、配置、密钥、健康检查、工具发现、允许列表和引用查看。
- MCP Host 支持 stdio、Streamable HTTP 与 legacy SSE，统一进入 Tool Runtime。
- Agent、Skill、Workflow 可声明连接器依赖；启动前给出可操作的缺失/未配置/离线门禁。
- 首批提供 Photoshop MCP 与 Cocos Creator MCP 连接器包，并让“固定 PSD → 标准 ArtBundle”工作流声明并使用它们。
- 外部项目导入时只导入连接器声明和密钥槽位，明文密钥不进入能力包或公开 IPC。

# Target users
- 需要把外部项目中的 Agent、Skill、Workflow 与 MCP 能力迁入 KnowMe 的智能体运维专员。
- 需要运行 PSD 切图与 Creator 验收管线的美术、技术美术和研发用户。
- 需要新增任意第三方 MCP 连接器而不修改 Agent 内核的能力开发者。

# Acceptance criteria
- 用户可在能力中心配置、启停、测试 Photoshop / Creator 连接器并查看发现的工具。
- 密钥以系统加密存储，列表、日志、导出和渲染层均不返回明文。
- 三种 MCP 传输均走同一个会话工厂；工具调用进入统一风险、审批、允许列表和回执链路。
- 缺少必需连接器时 PSD 工作流不能静默启动，并能定位到能力中心完成修复。
- 导入包含 URL、headers 或环境变量的 MCP 声明时，敏感值被剥离并转成待配置密钥槽位。
- 连接器平台与 PSD 工作流均有自动化测试，项目质量门禁通过。

# Non-goals
- 不在本 change 内实现 Photoshop 或 Cocos Creator 第三方 MCP 服务端本身。
- 不把 Photoshop / Creator 逻辑硬编码进通用 Agent 执行器。
- 不允许未声明、未启用或不在允许列表中的工具绕过 Tool Runtime 直接执行。

# Impact
主要影响 `src/lib/connectors/`、`src/lib/mcp-host.ts`、连接器 IPC / preload、能力中心 UI、外部能力导入和 PSD ArtBundle 工作流预检。旧 `mcp-default` 与既有连接器保持可读并自动适配。
