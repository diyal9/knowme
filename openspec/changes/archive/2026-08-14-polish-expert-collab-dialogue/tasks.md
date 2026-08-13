## 1. 提示词分层与装配（agent-context-assembly）

- [x] 1.1 文档化并实现 L0–L6 分层组装：KnowMe 对话结构默认 → Agentic 脚手架 → Soul → SOP → 属性/能力 → Session → 技能
- [x] 1.2 旧 `systemPrompt` 兼容映射为 SOP；缺省 `agenticType=react`
- [x] 1.3 单测：分层块存在、两专家差异、规划/反射脚手架可区分、协议层不被专家关闭

## 2. 专家包与 Session 快照（expert-runtime）

- [x] 2.1 EXPERT.md / manifest 读写 Soul、SOP、`agenticType` 与模式配置；校验五类枚举
- [x] 2.2 Session 快照冻结 Soul/SOP/Type；Hub 后改不影响已开 Session
- [x] 2.3 Session context-update 支持技能/连接器绑定覆盖（与 knowledgeRefs 并列），不写回专家包

## 3. Hub 编辑器：Soul / SOP / AgenticType（capability-hub + expert-agentic-profile）

- [x] 3.1 创建/编辑表单增加 Soul、SOP 分区与 AgenticType 下拉（五类中文标签）
- [x] 3.2 按 Type 联动显示配置字段与占位文案；切换不清空 Soul/SOP
- [x] 3.3 保存/加载/复制为自建完整持久化；精选只读仍须先复制

## 4. Runtime 模式脚手架（expert-agentic-profile）

- [x] 4.1 为 reflection / tool_use / react / planning / multi_agent 提供脚手架文本或策略开关
- [x] 4.2 `multi_agent` 仅委派边界说明，不启动完整多 Agent 图；文案引导工作流编排
- [x] 4.3 夹具专家冒烟：不同类型首轮结构可观察差异

## 5. 协作房侧栏与空态（workbench-dialogue-chrome + agent-chat-ux）

- [x] 5.1 右侧连接器/技能/知识可管理；知识与 Composer 同步；limited 连接器可导向配置
- [x] 5.2 `expert-chat` 空态走专家协作首屏，展示专业线索；工作流空态不变
- [x] 5.3 侧栏展示专家身份与 Type/职责摘要（可得时）

## 6. 自测与证据

- [x] 6.1 单测 + 静态契约覆盖装配分层、Hub 字段、空态分支、侧栏入口
- [x] 6.2 `npm test` && `npm run lint`；更新 `evidence/dev-self-test.md`
