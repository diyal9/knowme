## 1. Unified Manifest v2

- [x] 1.1 实现 v2 schema 规范化、校验、风险与 provenance 纯函数
- [x] 1.2 实现 Skill、Expert、Connector、Pack 与 Cursor linked legacy adapters
- [x] 1.3 实现依赖图缺失、可选项、歧义与环检测
- [x] 1.4 增加 Manifest v2 单元测试

## 2. 安装与生命周期

- [x] 2.1 让 capability import/store 安装前校验声明、trust、依赖与风险
- [x] 2.2 对受管 legacy 能力 materialize sidecar 并保留旧 store entry 兼容
- [x] 2.3 对安装与启用操作强制 required dependency 和 high-risk 确认

## 3. Connector 单源化

- [x] 3.1 实现 Connector manifest adapter 与 unified store 读取
- [x] 3.2 实现 legacy connectors.json 幂等迁移、备份、投影和回退开关
- [x] 3.3 将设置页 IPC、Hub allowlist/启停/卸载和 Agent runtime 接到 unified store

## 4. Catalog 与 Runtime

- [x] 4.1 Catalog 与 Hub DTO 透传真实依赖、权限、输入输出、风险与 provenance
- [x] 4.2 Expert 创建 Session/试聊前验证统一 bindings
- [x] 4.3 Skill 与 Cursor linked runtime 接入统一声明并保持路径边界
- [x] 4.4 Capability Pack 复用统一依赖与聚合风险模型

## 5. Hub 治理体验

- [x] 5.1 详情抽屉展示依赖、权限、输入输出、风险和来源证据
- [x] 5.2 缺失依赖给出阻断说明，可选依赖给出警告
- [x] 5.3 high/critical 安装或启用增加明确确认且保持现有三 Tab 布局

## 6. 验证与交付

- [x] 6.1 扩展 store/import/catalog/integration/expert/skill/connector/pack/Hub 测试
- [x] 6.2 运行 OpenSpec strict validate 与聚焦回归
- [x] 6.3 运行完整 test/lint 和 Electron 真机冒烟
- [x] 6.4 完成开发自测、制作人验收、QA、code review 与 Story 门禁
