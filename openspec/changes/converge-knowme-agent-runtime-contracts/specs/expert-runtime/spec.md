# Delta Spec: expert-runtime

## ADDED Requirements

### Requirement: Expert planning produces a host-validated structured outcome

新专家规划轮次 MUST 产出版本化 `ExpertPlanningOutcome`，明确为 `clarifying` 或 `ready`，并包含唯一 display text。模型输出只是候选；主进程 MUST 校验 schema、未决问题、交付合同、能力可用性和权限预检。解析失败、校验失败或仍有未决问题时 MUST 保持待澄清，MUST NOT 签发计划确认凭证。

#### Scenario: Complete-looking prose contains unanswered questions

- **WHEN** planning outcome 同时包含完整计划和未解决问题
- **THEN** host 将结果判定为 clarifying
- **AND** UI 不显示确认执行入口

#### Scenario: Structured output is malformed

- **WHEN** 模型输出无法解析为受支持版本的 planning outcome
- **THEN** 运行时 MAY 执行一次有界格式修复
- **AND** 修复仍失败时保存可读错误并保持可继续讨论的待澄清状态
- **AND** MUST NOT 从正文正则推断新任务 ready

#### Scenario: Legacy planning task is reopened

- **WHEN** 旧任务不存在 structured planning outcome
- **THEN** compatibility reader MAY 使用现有文本分析器恢复显示状态
- **AND** 下一次重新规划必须写入结构化版本

### Requirement: Confirmed commission contract is separate from the internal execution plan

专家任务 MUST 分别保存用户确认的 `ExpertCommissionContract` 与 Agent 可更新的 `ExpertExecutionPlan`。确认 fingerprint MUST 绑定目标、范围、材料边界、交付物、验收条件、外部目标和风险等级，MUST NOT 因仅调整内部步骤、顺序或实现方法而失效。

#### Scenario: Agent refines implementation steps

- **GIVEN** 用户已确认合同 C1
- **WHEN** Agent 在不改变 C1 内容时拆分或重排执行步骤
- **THEN** internal plan 版本增加
- **AND** 现有合同确认仍有效

#### Scenario: Deliverable scope changes

- **GIVEN** 用户已确认合同 C1
- **WHEN** 新计划新增文件交付、外部目标或更高风险操作
- **THEN** 系统生成新合同版本 C2
- **AND** 旧确认失效，正式执行前必须重新确认

### Requirement: Planning confirmation operation approval and delivery acceptance are independent

计划确认只允许按已确认合同开始正式执行；具体工具批准必须绑定工具、参数摘要、目标资源、身份、范围和有效期；成果接受只改变交付物 acceptance 状态。三类决定 MUST 独立持久化和展示，任何一种都不能推导另外两种已完成。

#### Scenario: Plan is confirmed but write tool needs approval

- **WHEN** 用户确认专家计划且后续工具调用需要批准
- **THEN** 工具保持 pending_review 直至独立批准
- **AND** 计划确认不能直接执行该写操作

#### Scenario: Tool succeeds before delivery review

- **WHEN** 工具已成功产出 required artifact 且 completionPolicy 为 review
- **THEN** 专家任务进入 review 等待
- **AND** 工具成功不能记录为用户已接受成果

### Requirement: Expert collaboration renders one canonical answer and separate actions

专家任务房 MUST 以 Session message 作为回答正文事实源；Task event、attention 和 choice 只能引用该消息或呈现状态/动作。新任务默认 completionPolicy 继续为 `review`，并与 planningPolicy、execution authorization 分开。

#### Scenario: Planning answer also creates an attention action

- **WHEN** ready planning answer 已作为 assistant message 提交并产生确认动作
- **THEN** 页面显示一条 planning answer 和一个确认动作
- **AND** MUST NOT 再显示内容相同的第二条回答

#### Scenario: Task reloads while waiting for review

- **WHEN** 用户刷新处于 review 的专家任务
- **THEN** canonical answer、deliverable summary 和 review action 分区恢复
- **AND** 不生成新的助手消息或自动接受成果
