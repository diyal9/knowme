# Producer Acceptance

目标范围通过。

- “智能体运维专员”可在对话内执行只读预览、等待用户确认、按同一内容快照导入并返回实际 ID 映射。
- 能力中心只发布 `external-capability-importer` Expert，不发布同名独立 Skill；curated 安装结果与运行时加载类型均为 `expert`。
- Cursor 仓库导入已覆盖 Skill、Expert、安全 MCP 与 Workflow，工作流保存为 `team / draft`，不会绕过首次成功 Run 的发布门禁。
- `D:\aiworkspace\th-art` 的 PSD → ArtBundle 主流程已完成真实扫描和临时用户目录注册验证：17 个节点、5 个人工门禁，引用 2 个已导入专家。
- 智能体运维专员可按目标 Workflow 生成依赖闭包规划 token，确认后只导入规划内资产；th-art 精确包为 1 Workflow、2 Expert、10 Skill，13 项安装成功。
- 外部文档只作为资料读取；明文凭据、deprecated/hidden 工作流和未解析专家引用均失败关闭。

产品边界：Photoshop 与 Creator 是外部运行依赖，必须另行配置可信连接器；未连接时不得宣称 PSD 生产链已真实跑通。
