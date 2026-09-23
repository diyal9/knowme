---
name: agent-registry-operations
description: 用于创建、优化、评估和治理 KnowMe 的 Agent 与 Skill；先通过对话补齐定义并只读校验，再展示变更和未验证项，获得明确确认后提交。
version: 1.5.0
disable-model-invocation: false
requiredTools: [list_manageable_agents, get_agent_definition, get_agent_draft, update_agent_draft, verify_agent_definition, preview_agent_change, commit_agent_change, list_agent_revisions, check_agent_eval_runtime, setup_agent_eval_runtime, save_agent_eval_suite, run_agent_eval, get_agent_eval_report, list_manageable_skills, get_skill_definition, verify_skill_definition, publish_skill_definition]
---

# 能力治理

## 适用范围

当用户要创建或维护专业 Agent 或 Skill 时使用。日常办公任务本身由伙伴处理，不因任务频繁就新建能力；只有职责长期稳定且需要独立上下文、权限或知识边界时才建议成为 Agent，可复用的方法与指令建议成为 Skill，固定步骤编排建议成为工作流。

## 专业定义

创建或更新前，形成完整定义：稳定 id、清晰名称和职责描述、语义化版本、Soul 判断准则、可执行 SOP、Agentic 模式、方法型 Skill、必要 Connector、知识引用、适用场景、能力边界、输入、输出、执行路线、交付物、至少两条质量复核标准、权限白名单和风险说明。

Skill 是方法，Connector 是外部能力，Agent 是承担结果责任的角色。不要把工具名写成专业能力，也不要靠提示词承诺不存在的权限。所需依赖必须已安装且启用；网络或写入能力必须提高风险等级并说明原因。

Skill 定义至少包含稳定 id、名称、清晰的触发描述、完整 Markdown 指令、输入输出、执行步骤、边界、失败处理和评估标准。新建 Skill 时通过对话逐步澄清，不要求用户先填完整表单。

## Agent 操作协议

1. 协作房已绑定对象时，必须使用上下文中的精确 Agent ID，不得自行改成同名对象。现有 Agent 使用 `get_agent_definition` 读取完整定义，新建 Agent 使用 `get_agent_draft` 读取草稿；不要要求用户重复提供已有信息。只有未绑定对象时才使用 `list_manageable_agents` 让用户选择。
2. 先判断这个需求应成为 Agent、Skill 还是工作流。只有确实需要持续上下文、独立职责和权限边界时，才继续完善 Agent。
3. 把建议修改和仍缺少的信息展示给用户；用户同意后才使用 `update_agent_draft` 保存草稿。草稿更新不等于发布。
4. 使用 `verify_agent_definition` 做只读校验；有阻断项就继续调优，不进入发布。
5. 使用 `save_agent_eval_suite` 冻结评估集。按 DeepEval 的三个范围选择指标：端到端评估最终输出，组件评估工具选择/参数，轨迹评估完整决策链。KnowMe 当前只有端到端和组件适配；没有真实 trace 时不得把普通消息拼成轨迹指标。
6. 评估集至少包含正常×2、边界、失败重试、反馈修改和重开六类场景。每个用例写清 input、期望输出或判据、期望/允许工具和阈值；自定义专业质量优先使用 G-Eval criteria，硬权限与工具匹配使用确定性指标。
7. 使用 `check_agent_eval_runtime` 检查本机 DeepEval。未安装时可在用户明确批准后调用 `setup_agent_eval_runtime`，把依赖安装到 KnowMe 用户数据下的隔离 Python 环境，不修改应用源码或系统 Python；没有本地 Python 时保持阻断。未安装期间仍可运行本地文本断言、工具正确性和工具权限指标；G-Eval、相关性、忠实度、幻觉和参数正确性必须保持 blocked。
8. 先真实运行目标 Agent，再把实际输出、工具调用和证据引用作为 observation 交给 `run_agent_eval`。禁止由被测 Agent 猜测或补写 observation。语义指标可能访问已配置的裁判模型并消耗 token，因此执行须经宿主审批；报告默认只保存在本地，不上传 Confident AI。
9. 使用 `get_agent_eval_report` 分析失败指标、原因、场景覆盖、配置 hash 和阻断项，完成调优后重跑同一冻结评估集。报告中的 scenario-regression gate 仅证明当前配置的冻结回归，不等于独立专业认证。
10. 使用 `preview_agent_change` 生成变更摘要和一次性 `change_token`。把动作、目标、变更字段、风险、生命周期及回滚影响展示给用户。
11. 等待用户对当前预览明确确认。确认只针对这一个令牌，不得复用旧确认或自行把确认参数设为真。
12. 获得确认后调用 `commit_agent_change`。提交会再次检查令牌、有效期和预览后的并发变化，并由宿主执行写操作审批。
13. 使用 `list_agent_revisions` 核对 revision。需要回滚时先预览 rollback，再按同一确认协议提交；回滚会生成新 revision，不覆盖历史。

## Skill 操作协议

1. 协作目标给出 Skill ID 时，使用 `get_skill_definition` 读取现有 SKILL.md；没有目标 ID 时，先与用户澄清使用场景、触发方式、输入输出、步骤、边界、失败处理和验收标准，不直接要求填写完整定义表单。
2. 如果需要从已安装列表选择目标，使用 `list_manageable_skills`。用户自建 custom Skill 可以更新；内置、精选或外部安装 Skill 只读，修改时必须使用新 ID 创建用户自建副本。
3. 形成完整定义后，先向用户展示关键结构，再调用 `verify_skill_definition`。逐项解决阻断问题；warning 可以保留，但必须在发布前明确说明。
4. 至少设计正常、边界、失败和反馈修改四类评估用例。静态校验只验证定义可发布，不能证明行为有效；没有真实执行输出时，评估状态必须保持 `not_run` 或待验证。
5. 优化现有 Skill 时，说明原定义、建议修改、兼容性影响和未验证项。不得把专家自己对文本的观感冒充真实执行证据。
6. 只有用户对当前完整定义明确确认后，才调用 `publish_skill_definition`。该工具还需要宿主审批，并且只能创建或更新用户自建 Skill。
7. 发布后重新使用 `get_skill_definition` 核对实际内容。发布失败时报告原因并保留当前定义，不宣称已经创建或更新。

## DeepEval 指标选择

- `g_eval`：针对具体专业标准的 LLM-as-a-judge；必须给出 criteria，建议同时使用 actual_output 与 expected_output。
- `answer_relevancy`：最终答复是否回应任务；不代替事实正确性。
- `faithfulness` / `hallucination`：有检索上下文或上下文基准时使用。
- `tool_correctness`：将真实工具调用与 expectedTools 对照；需要时启用参数、输出、顺序或精确匹配。
- `argument_correctness`：由裁判模型判断工具参数是否适合输入；无裁判模型时不得给分。
- `tool_permission`：确定性检查最小权限，适合作为硬门禁。
- `text_assertions`：本地、零 token 的 mustContain / mustNotContain 基线，只能验证明确文本断言。

## 生命周期

下架使用 retire：禁止新任务、清理工作台和工作流入口，但保留 Agent 包、revision 与既有任务快照。恢复使用 restore。不要用删除代替下架；只有用户明确要求永久删除自建 Agent 时，才走单独删除能力。

普通用户只能读取、评估和调优自己创建的 Agent。管理员可以对系统或精选 Agent 建立运行时覆盖版本，但仍必须执行校验、冻结评估、预览、明确确认和 revision 留痕；不得修改应用源码中的内置包。对已下架 Agent，不得通过子 Agent 或其他内部入口绕过生命周期门禁。

## 交付

报告对象类型、校验结果、预览摘要、用户确认依据、Agent revision 或 Skill 实际定义、当前生命周期，以及仍未完成的真实资格验证。定义通过只代表结构与约束就绪，不得宣称已经通过真实业务场景的专业验收。
