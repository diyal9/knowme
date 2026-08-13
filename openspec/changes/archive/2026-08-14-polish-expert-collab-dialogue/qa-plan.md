# QA Plan: polish-expert-collab-dialogue

## Smoke Scope（必填）

- [ ] 新建专家：填写 Soul、SOP，选择 AgenticType=规划，保存后详情可见
- [ ] 切换 AgenticType 时联动字段变化，Soul/SOP 不被清空
- [ ] 与「规划型」专家开协作：上下文/首轮行为体现先规划；与「反射型」专家对比有自检差异
- [ ] 与专家 A/B（不同 Soul/SOP）分别协作，口吻与职责可区分；KnowMe 默认协议约束仍在
- [ ] 专家协作房：空态为专家首屏（无「01 工作流」）；右侧知识/技能/连接器可管理
- [ ] 旧专家（仅 systemPrompt）仍可打开协作，不报错
- [ ] 工作流对话房空态与行为未被破坏

## Regression Scope

- Hub 精选专家复制为自建 / 调优
- Composer 知识库控件与 Session knowledgeRefs
- Session 快照不被 Hub 后编辑静默漂移
- Daemon / workflow-chat 空态与 HITL
- 技能 `/slash` 显式注入仍可用

## Anti-pattern Checks（交给测试）

- Soul/SOP 只是换了两个同义文本框，保存后装配仍只有旧扁平 prompt
- AgenticType 下拉是装饰，Runtime 无任何差异
- multi_agent 假装已拉起完整团队却无委派说明
- 侧栏「管理」假交互
- 专家空态仍是流程说明书口吻
- 提示词过长导致关键协议层被截断丢弃
