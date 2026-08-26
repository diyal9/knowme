# QA Plan

## Smoke Scope

- [x] 能力中心可打开已安装连接器的实例配置并保存普通配置与加密密钥。
- [x] legacy SSE 会话可初始化、发现和调用工具；stdio / Streamable HTTP 回归通过。
- [x] 外部 MCP 明文凭据被转换为待配置密钥槽，公开预览不含原值。
- [x] 必需连接器不可用时工作流启动门禁阻止，可选连接器只提示降级。
- [x] PSD 工作流持久化 Photoshop / Creator 依赖并按布局模式判定。
- [x] 真人 Photoshop / Creator 服务端联调：能力中心在线探测、工具发现与只读调用均通过。

## Functional
- 安装 Photoshop / Creator 连接器后可编辑本机配置，密钥字段刷新后仍只显示已配置状态。
- 健康检查成功时展示连接状态和工具清单；服务离线时展示可执行的修复提示。
- 取消某工具授权后，Agent 调用被 Tool Runtime 拒绝且生成失败回执。
- PSD 工作流在 Photoshop 缺失、未配置、关闭、离线时分别阻止启动。
- 绝对布局模式允许 Creator 缺失并给出 CLI 降级提示；Widget 模式必须具备 Creator。

## Security
- manifest、连接器列表 IPC、导入预览、日志和回执不包含 token、Authorization 或密钥值。
- 外部 MCP 文件中的明文 header/env 只生成密钥槽，导入实例处于待配置状态。

## Regression
- 旧 mcp-default 和飞书连接器仍可列出、启停和运行。
- 既有 Workflow v1/v2、Agent 工具投影和能力中心安装卸载测试保持通过。
