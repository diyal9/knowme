# 制作人验收

日期：2026-08-22

## 结论

功能范围与真实 Photoshop / Creator 只读联调均已完成；项目总门禁仍有并行 UI 改动导致的既有失败，暂不归档 change。

## 已验收体验

- 能力中心可安装 Photoshop MCP 与 Cocos Creator MCP，并在详情中管理实例。
- 实例界面覆盖传输、命令/URL、工作目录、非敏感环境变量、加密密钥、连接测试、工具发现、允许列表和引用。
- 智能体运维专员可规划 Connector Package、工具策略和依赖门禁；不会索取或回显密钥。
- PSD 工作流在启动前检查连接器与本地项目条件，Widget/absolute 的必需与降级规则清晰。
- 导入器接受 stdio、Streamable HTTP、legacy SSE，并将外部明文凭据转为待配置密钥槽。

## 真实环境验收

- Photoshop 2025：stdio MCP 在线，发现 80 个工具；`photoshop_ping` 返回 `Successfully connected to Photoshop`，`photoshop_get_version` 返回 `Photoshop version: 2025`。
- Cocos Creator：Legacy SSE MCP 在线，发现 16 个工具；`ping` 返回 `pong`，`get_editor_context` 成功读取当前 `ArtBundleDebug` 场景且场景未脏。
- 能力中心实机显示两项连接器已安装、已启用、在线；Creator token 仅显示“已安全保存”，截图未暴露密钥。
- 默认授权已按实机工具清单修正为只读集合。Creator 导入与 Photoshop 导出等写操作仍需用户在能力中心单独授权，并在运行时审批。
