## Context

参见 `proposal.md`。当前 Hub 的 install store 仅存生命周期字段，Catalog 仅存展示字段，Skill/Expert/Connector/Pack 各自解析不同 manifest。Connector 配置还在能力目录 manifest 与 `%APPDATA%\KnowMe\connectors.json` 间双写，Agent MCP runtime 主要读取后者。现有 IPC 和 preload 已被设置页、Hub 与 Agent 依赖，必须保持兼容。

## Goals / Non-Goals

**Goals:**

- 用纯函数统一声明校验、legacy 适配、依赖图、风险和 provenance
- 让声明与运行状态分离：manifest 是能力事实，install store 是状态事实
- 收敛 Connector 到单一权威读取路径，同时保留可回滚投影
- 在不改变 Session 快照和 IPC 形状的情况下接入运行时
- 避免启动时遍历/解析全部能力正文，按需读取并保持轻量缓存

**Non-Goals:**

- 不将 capability graph 持久化为图数据库
- 不改变 MCP stdio transport 或引入远程认证
- 不删除 legacy 文件和 adapter
- 不让 Renderer 获得文件系统或 manifest 写权限

## Decisions

### 1. `capability.manifest.json` 为可选 v2 sidecar

v2 使用共同字段：

- `schemaVersion`, `id`, `kind`, `name`, `description`, `version`
- `dependencies[]`: `{ id, kind?, required, version? }`
- `permissions`: 规范化资源与动作声明
- `inputs[]`, `outputs[]`
- `risk`: `{ level, reasons[] }`
- `provenance`: `{ source, ref, trust, contentHash, adaptedFrom? }`

受管目录安装时 materialize sidecar；无 sidecar 时按 kind 使用 adapter。Cursor linked 能力只在内存/Store DTO 中适配，绝不写回仓库。

选择 sidecar 而不是修改 SKILL.md/EXPERT.md frontmatter，是为了兼容生态格式并避免复杂 YAML 解析。声明不含 enabled/status，防止版本控制内容与设备状态冲突。

### 2. Manifest 模块保持纯函数，IO 留给调用方

核心模块负责 normalize/validate/adapt/resolveDependencies/aggregateRisk，输入普通对象，输出 `{ok,...}`。文件发现和写入由 import、catalog 与 runtime 完成。

纯函数便于覆盖依赖环、版本和风险测试，也避免把 Electron/fs 依赖扩散到契约层。

### 3. 依赖验证分两层

静态层验证单个 manifest 与图结构；运行层以 install store + catalog/runtime 可用性判断 required 依赖是否存在且 enabled。Optional 缺失仅产生 warnings。Pack 将原有字符串依赖适配为统一引用，并把 Expert/Skill/Connector 引用加入依赖集合。

### 4. Connector unified store 采用“manifest + install store + compatibility projection”

新增 unified Connector store：

1. 扫描受管 `capabilities/connectors/<id>/manifest.json` 或 sidecar；
2. 与 install store 合并 enabled/status；
3. 若能力目录无条目，读取 `connectors.json` 作为 legacy fallback；
4. 所有 upsert/allowlist/enable/remove 先写权威 manifest/store，再重建 `connectors.json` 投影。

通过环境/依赖注入的兼容开关可回到 legacy-only 读取。迁移先备份 `connectors.json` 和 install store，标记版本且幂等。投影不保存 token 值，仅保留 env key。

### 5. Catalog 在合并阶段读取统一声明

Catalog 条目继续承担搜索和营销元数据，安装目录/linked 来源提供治理声明。合并结果把 dependencies、permissions、inputs、outputs、risk、provenance 透传到 Hub DTO。读取失败时保留条目并附 validation issues，不伪造空依赖。

### 6. Runtime 以统一依赖状态做前置校验

Expert 在 snapshot/try-chat 前调用 binding resolver；Skill L0 附加声明元数据但不改变正文加载和沙箱；Pack 复用统一依赖 resolver；Connector Agent projection 使用 unified store。旧 Session 快照不重写。

### 7. 高风险确认由后端强制、UI 显式表达

Hub 对 high/critical 安装或启用请求必须携带 `riskConfirmed=true`。后端未收到确认时返回 `risk_confirmation_required` 及安全摘要，防止仅靠前端提示被绕过。

## Electron Boundary and Performance

- 主进程拥有 manifest、目录、迁移和 store IO；preload API 名称与参数形状不变
- Renderer 仅接收序列化 DTO，不接收本地绝对路径或 secret
- list 操作只读取小型 JSON/frontmatter；SKILL.md 正文、资源和脚本继续按 L1–L3 延迟加载
- 单次 Hub 列表调用使用请求内缓存，状态变更后失效，不创建常驻文件监听器

## Risks / Trade-offs

- [adapter 推导字段可能不如作者显式声明精确] → provenance 标记 adaptedFrom，UI 可区分推导值
- [兼容投影仍保留双文件] → 所有写操作只通过 unified store，投影单向生成并有回退开关
- [依赖 ID 跨 kind 冲突] → dependency 可声明 kind；无 kind 时要求全局唯一或返回歧义错误
- [高风险门禁影响现有一键安装] → curated 低风险默认无额外确认，只有 high/critical 返回确认流程
- [启动迁移失败] → 保留备份和 legacy fallback，错误不阻止应用启动但在 Hub 显示 degraded

## Migration Plan

1. 发布纯 Manifest v2 adapter 与测试，不改变现有读路径。
2. 安装/import materialize sidecar，Catalog 开始透传治理字段。
3. 首次启动 Connector unified store：备份 → legacy 导入 → 校验 → 写 install store/manifest → 重建投影 → 写迁移标记。
4. 将 Hub、设置 IPC 和 Agent Connector runtime 切到 unified store；保留 legacy fallback 开关。
5. 接入 Expert/Skill/Pack 依赖校验和 Hub 风险确认。
6. 回滚时关闭 unified read，使用未删除的 `connectors.json`；v2 sidecar 和新增 store 字段会被旧版本忽略。
