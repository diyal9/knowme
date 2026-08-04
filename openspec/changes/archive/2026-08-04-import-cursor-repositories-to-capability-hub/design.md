## Context

能力 Hub 当前通过主进程 IPC 管理 `%APPDATA%\KnowMe\capabilities\`，导入器只接受单个 SKILL.md、EXPERT.md 或 connector manifest。工作台已有读取活动仓库 `.cursor/agents/` 的能力，但该逻辑没有接入 Hub，也不处理技能 catalog、启停和安全注册。现有部分 Cursor 技能引用仓库级 `kb/`、`info/` 或业务文件，孤立复制技能目录会使这些依赖失效。

## Goals / Non-Goals

**Goals:**
- 主进程安全扫描本地 Cursor 仓库，Renderer 只接收可展示 DTO。
- 以链接来源注册技能，保留仓库语义，同时把可变管理状态存入 AppData。
- 复用现有 Expert、Skill、Connector Runtime 和统一 catalog。
- 扫描按用户动作执行，不增加应用启动时的全仓库遍历。

**Non-Goals:**
- 不扩展工作台的多 Agent 工作流模型；Hub Expert 仍是 persona + bindings。
- 不自动安装外部运行时、设置环境变量或执行仓库命令。
- 不实时 watch 仓库；用户通过重新导入显式刷新。

## Decisions

### 1. 新增纯扫描模块与两阶段 IPC

新增主进程纯 Node 模块负责 `scanCursorRepository(root)` 与 `registerCursorRepository(preview, selection)`。IPC 分为：
- `capability-scan-cursor-repo`：只读扫描，返回一次性 preview token 与 DTO。
- `capability-import-cursor-repo`：校验 token、规范路径及用户确认后写入。

扫描结果不向 Renderer 暴露文件正文或潜在 secret。备选方案是在 Renderer 递归读取目录，但这会破坏 Electron 安全边界并扩大路径攻击面。

### 2. 链接技能只存元数据，不复制仓库

install store 条目扩展 `originRoot`、`originPath`、`repositoryId` 与 `linked=true`；catalog overlay 保存展示元数据。Skill Runtime 从 install store 枚举链接技能，并在每次读取前验证：
- originRoot 仍存在且是目录；
- originPath 解析后位于 originRoot 内；
- SKILL.md 与资源/脚本路径位于技能目录允许范围。

备选方案是复制整个仓库，代价是空间、更新一致性和敏感文件风险；复制单技能则会破坏仓库级依赖。

### 3. Expert 适配为 AppData 中的标准快照包

Cursor Agent 的 AGENT.md 正文转换为标准 EXPERT.md，agent.manifest.json 的 required/optional skills 与 MCP 绑定经过已发现集合过滤。没有 Agent 的仓库根据主入口技能生成一个标准 Expert：
- 优先名称包含 `assistant`、`orchestrator` 或与仓库名相近的技能；
- 否则按稳定排序选择第一个；
- Expert 绑定全部成功注册技能。

生成后的 Expert 写入 AppData，因此 Session 快照与现有 Expert Runtime 无需读取外部 Agent 格式。这样也避免 Agent 文件后续变化悄悄改变已有安装；用户重新导入才更新未来 Session。

### 4. MCP 仅接受可安全投影的 stdio 配置

扫描 `.cursor/mcp.json` 的 `mcpServers`：
- command、args、cwd 和非敏感环境变量名可投影为 connector manifest；
- env 值仅允许 `env:VAR_NAME` 或空占位；
- 检测到明文 secret 时该 connector 标记 blocked，不写盘；
- HTTP/SSE 等当前 Host 不支持的形态标记 skipped。

连接器注册同步写统一 install store 和现有 connector store，保持健康检查与 allowlist 路径可用。

### 5. 统一 catalog 必须合并所有 install store 条目

`mergeCatalog` 在 bundled/overlay 之外补入尚无 catalog 项的 install entries，并优先使用 overlay 展示元数据。所有成功导入路径同时 upsert overlay，避免“运行时已安装但 Hub 不可见”。

### 6. 信任确认由 UI 显式闭环

普通本地包和 Cursor 仓库首次导入均先返回 `trust_required` 或预览确认状态。Renderer 检查 `{ok:false}`，展示路径和风险，用户确认后传 `trustConfirmed:true` 重试；任何失败均保留对话框并显示错误。

## Risks / Trade-offs

- [仓库被移动导致能力失效] → 列表标记来源不可用，重新导入同一 repositoryId 或卸载。
- [链接技能可观察到仓库后续内容变化] → catalog 展示内容哈希与“重新导入以刷新”语义；Session Expert 仍冻结，技能调用按当前受控文件读取。
- [不同仓库技能 ID 冲突] → 默认保留原 ID；冲突时使用 `<repo-id>--<skill-id>` 稳定命名并在预览展示映射。
- [大型仓库扫描性能] → 只访问固定 `.cursor` 子树，设置目录/文件上限，不递归扫描仓库其他内容。
- [Cursor MCP schema 差异] → 只投影明确支持的 stdio 子集，其他配置以警告跳过。
- [已有 install-store schema] → 新字段均为可选，旧记录保持兼容。

## Migration Plan

1. 以可选字段扩展 install store 与 overlay，不迁移旧数据。
2. 发布后旧精选、本地、ZIP 与自定义能力保持原行为。
3. 若需回滚，移除新 IPC/UI；新增记录仍是合法 install entry，链接字段会被旧版本忽略。
4. 卸载仓库导入能力时只删除 AppData 注册与生成的 Expert/Connector，不修改原仓库。
