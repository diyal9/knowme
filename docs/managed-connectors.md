# 受管连接器与 PSD → ArtBundle 使用指南

## 产品分层

- **连接器包**：可分发的传输、配置字段、密钥槽、健康检查和工具策略。
- **连接器实例**：当前电脑上的命令、路径、URL、启停状态和工具允许列表。
- **Tool Runtime**：Agent 真正调用工具的统一入口，负责风险、审批、超时与 Tool Receipt。
- **能力依赖**：Agent、Skill、Workflow 只声明需要哪个连接器和工具，不持有密钥或 MCP 客户端。

## 更新智能体运维专员

能力中心 → 专家 → 智能体运维专员 → **更新专家**。如果旧版本无法更新，可先卸载再重新召唤；个人工作流和连接器实例不随专家卸载删除。

更新后的专员会先预览外部项目、规划 Workflow → Agent → Skill → Connector 依赖闭包，经确认后导入并验证。它也会把外部 stdio / HTTP / SSE MCP 配置转换为受管连接器声明；发现的明文凭据只转为 `needs_configuration` 密钥槽，不会被复制或回显。

## 安装和配置首批连接器

在能力中心切换到“连接器”，分别安装 **Photoshop MCP** 与 **Cocos Creator MCP**，然后打开详情中的“连接器实例”。

### Photoshop MCP

1. 传输选择“本机 stdio”。
2. 启动命令填写 Node.js 或服务端可执行文件。
3. 参数每行一个，至少包含 Photoshop MCP 服务入口。
4. 工作目录填写服务所在目录。
5. 非敏感环境变量填写 `PHOTOSHOP_PATH=<Photoshop.exe 绝对路径>` 和可选 `LOG_LEVEL=info`。
6. 保存后测试连接；发现工具并授权只读工具 `photoshop_ping`、`photoshop_get_version`、`photoshop_get_document_info`、`photoshop_get_layers`。实际导出工具属于写入能力，应在确认风险后单独授权。

### Cocos Creator MCP

1. 默认使用 Legacy SSE，URL 为本机 Creator MCP 地址（默认示例 `http://127.0.0.1:3103/sse`）。
2. 在密钥字段填入 Access Token。值由 Electron `safeStorage` 加密，刷新后只显示“已配置”。
3. 测试连接并发现工具。
4. 建议先授权只读工具 `ping`、`get_project_info`、`get_editor_context`、`query_scene_hierarchy`；`refresh_assets`、`open_scene`、`import_dsl_bundle` 会修改编辑器工程，需要单独授权，其中导入工具还必须经过运行时审批。

## 导入并运行 PSD 工作流

1. 打开智能体运维专员，使用快捷任务“导入 PSD → ArtBundle 产线”。
2. 让专员扫描 `D:\aiworkspace\th-art`，只选择 `th-art-psd-to-artbundle`，查看精确依赖规划。
3. 明确确认后导入；专员会报告实际 Skill、Agent、Connector、Workflow ID，并验证图和引用。
4. 到工作台 → 视觉分类打开“固定 PSD → 标准 ArtBundle”，填写 PSD、任务标识、Creator 工程和布局模式。
5. 启动前会执行连接器、项目路径、固定脚本、Node.js 和输出边界预检。

布局规则：

- `widget`：Photoshop 与 Creator 连接器都必须在线。
- `absolute`：Photoshop 必须在线；Creator 不在线时可走项目固定 CLI 降级，并在运行结果中记录降级路径。

任何 `missing / needs_configuration / disabled / offline` 必需依赖都会阻止工作流启动，并给出返回能力中心修复的提示。

## 新增其它项目连接器

外部项目可在 `.cursor/mcp.json` 声明 stdio、Streamable HTTP 或 legacy SSE 服务。导入器会保留非敏感命令、参数、cwd、URL 和环境配置；`Authorization`、token、password、secret、API key 等只生成密钥槽。新工具默认采用保守的外部写入策略，必须在能力中心发现、分类并加入允许列表后，Agent 才能调用。
