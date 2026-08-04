## Why

KnowMe 的目标用户已经在 Cursor 仓库中积累了专家、技能和 MCP 配置，但能力 Hub 目前只能逐个导入单能力包，无法把一个现有智能体仓库作为完整能力来源接入。支持仓库级导入可以显著降低迁移成本，让团队已有 AI 资产直接成为可发现、可管理、可复用的产品能力。

目标用户是拥有一个或多个 Cursor 智能体仓库、希望在 KnowMe 中统一调用这些能力的个人与团队。商业与体验价值在于缩短首次可用时间、保留团队知识资产，并为后续能力包分发与团队订阅建立统一入口。

## What Changes

- 在能力 Hub 的“添加能力”中新增“Cursor 仓库”来源，允许选择仓库根目录。
- 扫描 `.cursor/skills/*/SKILL.md`、`.cursor/agents/*/{AGENT.md,agent.manifest.json}` 与 `.cursor/mcp.json`，生成导入预览并由用户确认。
- 将 Cursor Agent 适配为 Hub Expert；没有 Agent 定义但存在主入口技能的仓库，生成一个仓库级专家。
- 以本地仓库链接方式注册技能来源，保留仓库内相对路径和配套知识文件，不复制孤立技能导致依赖失效。
- 将导入结果同时写入 install store 与用户 catalog overlay，确保 Hub 可见、可筛选、可启停。
- MCP 配置只导入不含明文密钥的安全配置；存在敏感字段时阻止对应连接器安装并给出可读提示。
- 修复本地来源首次信任确认与导入结果错误处理，使失败不会被静默吞掉。

验收标准：
- 选择 `th-art` 后能发现其专家和技能，并在 Hub 对应 Tab 中显示已启用条目。
- 选择仅含技能的 `th-BI` 或 `th-config` 后能生成仓库级专家并绑定其技能。
- 已注册技能运行时从原仓库读取 `SKILL.md`、`references/` 与 `scripts/`，仓库外路径访问仍受安全校验。
- 重复导入同一仓库执行可预测更新，不产生重复条目。
- 无效仓库、明文密钥、失效路径和未知来源均返回可操作错误。

非目标（Non-goals）：
- 不把整个 Git 仓库复制进 `%APPDATA%\KnowMe\capabilities\`。
- 不自动执行仓库脚本、登录外部服务或写入密钥。
- 不在本 Change 中实现远程 Git clone、能力市场发布或多 Agent 工作流编排。

## Capabilities

### New Capabilities
- `cursor-repository-capability-import`: 发现、预览并注册 Cursor 仓库中的专家、技能与安全 MCP 配置。

### Modified Capabilities
- `capability-hub`: 增加 Cursor 仓库来源、导入确认、错误反馈及用户安装项可见性。
- `agent-skills-runtime`: 支持从已注册本地仓库安全读取和运行链接技能。
- `expert-runtime`: 支持由 Cursor Agent 或主入口技能生成并绑定 Hub Expert。

## Impact

- 主进程：Capability Hub IPC、仓库扫描、catalog/install store、技能与专家运行时。
- Renderer：能力 Hub 添加来源对话框、扫描预览和导入结果反馈。
- 用户数据：`%APPDATA%\KnowMe\capabilities\` 增加本地仓库注册信息和来源元数据。
- 安全：仓库路径校验、明文密钥扫描、脚本执行仍经现有 sandbox 权限。
- 测试：新增仓库扫描、幂等注册、运行时链接和 UI 接线测试；不新增第三方依赖。
