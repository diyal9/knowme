## Context

当前助理模式、用户偏好、Agent Profile 与 Product Memory 分散存在。Profile v2 已能表达 Skill、知识、连接器、权限和记忆策略，因此 v3 在原模型上扩展；个人代理不另建第二套能力配置源。Session Store 采用兼容字段投影，UI 先切换心智，旧数据不批量重写。

## Decisions

### 单例与数据归属

- 单例常量：`MY_KNOWME_PROFILE_ID=my-knowme`、`PERSONAL_AGENT_ID=personal`。
- Profile Store 仍是能力与策略事实源；Product Memory 仍是学习内容事实源。
- 成长记录是有界审计事件，保存提案、应用、撤销与 Profile 变更摘要，不复制原始完整会话。

### Profile v3 Reader/Writer

- Reader 接受 v2/非版本记录，补齐 `profileKind=overlay`、identity、contexts、taskPreferences。
- Writer 始终写 v3；`my-knowme` 强制 personal/唯一 id，其他 Profile 默认为 overlay。
- 情境包含工作区引用、岗位描述以及 Skill/知识/连接器/权限覆盖；引用继续走稳定 ref，不保存未授权绝对路径或凭据。

### 教导治理

- `personalAgentTeach` 只做分类和最小写入：明确“记住”且不涉及敏感类别时写 Product Memory，并产生可撤销事件。
- 推断、装备、知识或权限变化产生 proposal；`personalAgentApplyProposal` 再执行 Profile patch。
- Renderer 不直接写 AppData，所有操作通过主进程受限 IPC。

### Session 兼容

- Session Reader 只补充可安全推导的展示字段；旧字段原样保留。
- 新建自由会话固定 `personal-topic/my-knowme`。旧会话首次发送时由主进程保存新绑定，不改历史 message。

### Renderer

- Rail 和能力中心先完成名称与信息架构切换。
- Assistant 顶栏移除人格选择器，保留新主题、历史和工作场景快捷项。
- 成长面板以懒加载 overlay 实现，不进入首屏启动载荷。

## Electron boundaries

- 主进程：单例创建、Profile 校验、Product Memory 写入、成长审计与 Session 持久化。
- Preload：暴露结构化、有限字段的 personalAgent API。
- Renderer：只显示 DTO 和提交显式 patch/proposal 决策；不接触用户数据路径。

## Performance and retention

- 首次 `personalAgentGet` 才创建/读取单例，不在 boot 全量扫描。
- 成长事件最多保留 200 条，列表默认返回最近 50 条。
- 情境和引用均设置上限，Hash 使用规范化稳定载荷。

## Risks

- 旧测试依赖人格菜单文案：用兼容 Reader 保持会话数据，用测试显式更新新 UI 契约。
- Product Memory 撤销能力不完整：个人服务保存变更前值和事件引用，撤销仅允许受控字段/显式记忆条目。
- v2 Profile Hash 会变化：旧快照保留原 Hash；只有重新保存才生成 v3 Hash。
