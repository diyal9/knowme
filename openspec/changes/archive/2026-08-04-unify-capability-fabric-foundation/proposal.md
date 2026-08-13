## Why

KnowMe 的 Expert、Skill、Connector 与 Capability Pack 已分别可安装和运行，但它们使用不同声明、依赖、权限和风险字段，Connector 还同时依赖能力目录与 `connectors.json`。这使能力 Hub 无法真实回答“能力需要什么、能访问什么、是否可运行”，也阻碍 KnowMe 通过 Agent → Skill → Knowledge → MCP 支撑完整工作愿景。

## What Changes

- 引入向后兼容的 Capability Manifest v2，统一能力身份、依赖、权限、输入输出、风险和来源证据
- 为无 v2 sidecar 的 SKILL.md、EXPERT.md、connector manifest、Cursor linked 能力与 pack.json 提供 legacy adapter
- 安装前验证 manifest、依赖闭包、信任和风险；install store 继续作为运行状态权威
- 将 Connector 能力目录 manifest + install store 收敛为主数据源，`connectors.json` 保留为兼容投影与 legacy fallback
- 让 Catalog、Hub DTO、Expert/Skill/Pack runtime 读取统一声明并阻止缺失必需依赖
- 在详情抽屉展示真实依赖、权限、输入输出、风险和 provenance；高风险操作需确认

## 目标用户

- 希望在一个 Hub 中安全安装、理解和治理工作能力的 KnowMe 用户
- 希望组合 Expert、Skill、知识和外部系统的能力作者与企业管理员
- 依赖旧 SKILL/EXPERT/Connector 配置且不能接受升级中断的现有用户

## 验收标准

- 旧格式能力无需修改即可适配为统一声明并继续导入、启停和运行
- v2 manifest 可校验 schema、依赖环、缺失依赖、风险与 provenance
- 必需依赖缺失时安装或启用被阻止，可选依赖仅警告
- manifest-only connector 可运行，旧设置页 IPC 与 Hub 状态一致
- `connectors.json` 迁移幂等且有备份，兼容模式下仍可回退
- Hub 显示真实治理元数据，高风险能力启用前要求明确确认
- 聚焦测试、全量测试、lint、OpenSpec strict validate 和 Electron 冒烟通过

## 非目标（Non-goals）

- 不实现实体知识图谱、Work Graph 或向量检索重构
- 不实现 Streamable HTTP MCP、远程 OAuth Gateway 或远程能力市场
- 不删除 `connectors.json`，只降级为兼容投影与 legacy fallback
- 不新增能力包 Tab，不重构 Agent executor

## Capabilities

### New Capabilities

- `capability-manifest`: 统一 Expert、Skill、Connector 与 Pack 的声明、legacy 适配、依赖闭包、权限、风险和来源证据。

### Modified Capabilities

- `capability-hub`: Catalog 与详情抽屉展示真实治理元数据，并在安装/启用时执行依赖和高风险确认。
- `expert-runtime`: 创建 Session 或启用 Expert 前验证绑定的必需 Skill 与 Connector。
- `agent-skills-runtime`: 标准、legacy 与 linked Skill 读取统一声明元数据，同时保持 L0–L3 和路径边界。
- `connector-sdk`: 能力目录 manifest + install store 成为 Connector 权威，旧配置成为兼容投影与回退。
- `capability-pack`: Pack 复用统一原子能力依赖与权限模型，不维护第二套声明 schema。

## Impact

- 新增 `src/lib/capability-manifest-v2.js`、Connector unified store/adapter 与对应测试
- 修改 capability store/import/catalog/hub、Expert/Skill/Pack runtime、Cursor repository 与 Hub UI
- Connector 数据迁移会在 `%APPDATA%\KnowMe\capabilities\` 生成备份和投影状态
- 保持现有 IPC 名称、preload 形状、Session 快照与 Renderer 安全边界
