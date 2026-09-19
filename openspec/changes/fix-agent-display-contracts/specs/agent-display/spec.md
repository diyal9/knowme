## ADDED Requirements

### Requirement: Agent 显示名称统一
系统 SHALL 在首屏与能力详情采用同一任务模式名称规则，并保留全部有效模式。执行 ID SHALL 不作为缺失名称时的用户标题。

#### Scenario: 导入旧包缺少 label
- WHEN 路由只有有效 id 和 description
- THEN 导入和加载 SHALL 补齐可读 label，工作台与 readiness SHALL 一致，执行字段保持不变。

#### Scenario: 导入重复或空路由标识
- WHEN routes 不是数组，或包含空/重复 id
- THEN 声明验证 SHALL 失败，不能安装该无效声明。

### Requirement: 装配与权限呈现真实状态
系统 SHALL 保留新建和导入专家的技能与连接器信息，跨类型解析名称，显示权限布尔值和白名单范围。

#### Scenario: 专家列表只包含专家
- WHEN 打开已装配专家详情
- THEN 技能和连接器名称及可用安装操作 SHALL 从独立参考目录解析，不显示错误的未装配结论。

### Requirement: 未知和错误不得显示成功
系统 SHALL 仅在授权探测明确成功时显示已授权。

#### Scenario: 授权重新检测失败
- WHEN 返回错误或连接器不存在
- THEN SHALL 保留重新检测入口，不能收起授权提示并显示成功。

### Requirement: 委托摘要保留确认事实
系统 SHALL 在待验收、文本交付和文件交付阶段保留已确认交付约定。

#### Scenario: 纯文本成果已接受
- WHEN 成果没有文件引用
- THEN 交付约定 SHALL 继续显示，不回退到确认计划后锁定。

### Requirement: 计划确认只显示一次
系统 SHALL 合并前端即时/恢复确认消息与相同内容的 plan_confirmed 事件，采用一对一匹配，保留后台审计记录和其他用户发言。

#### Scenario: 确认后收到后台事件
- WHEN 对话包含平台生成的计划确认消息及其持久化事件
- THEN 默认对话 SHALL 只显示一条确认，不能影响启动次数。

#### Scenario: 历史任务只有后台事件
- WHEN 没有对应即时/恢复消息
- THEN SHALL 继续显示后台确认，不能吞掉历史确认事实。


### Requirement: Execution promises match runtime contracts
A confirmed plan promising a source package or runnable web deliverable MUST NOT enter model execution through an answer-only contract lacking required tools or artifact completion conditions. Creation and retry MUST both pause with a capability explanation. This check does not grant permissions; existing tool preflight remains authoritative.

### Requirement: Route selection follows user intent
Generated plan steps MUST NOT select a specialist route absent matching user intent. Explicit user supplements stored by the host remain eligible when the goal has no specialist match.

### Requirement: Failed attempts retain conversation access
After an execution fails, the task MUST keep one composer available for discussion. Sending a question MUST use the expert discussion lane and MUST NOT start or retry execution automatically. The explicit retry action remains available.


### Requirement: Clarification precedes plan confirmation
A complete plan followed by unanswered clarification MUST remain clarifying. A newer clarification MUST supersede an older plan. Both visible execution buttons and typed confirmation MUST use this state; a plan marker or historical consent prompt alone cannot permit execution. Pure plan-consent questions remain confirmable. A revised complete plan can clear resolved clarification.


### Requirement: JSON syntax failures receive actionable recovery
Invalid tool argument JSON MUST remain rejected before dispatch. Recovery MUST distinguish serialization syntax from missing task information and provide escaping/closure guidance. Diagnostics MUST NOT retain document contents or raw parser excerpts. An exhausted retry MUST NOT ask the user to supply unrelated tokens or query terms.


### Requirement: User confirmation closes expert collaboration
New expert commissions MUST produce all required outputs and then enter review with pending acceptance. Output generation and tool completion MUST NOT close the commission. Without user action the persisted review state remains waiting indefinitely, including after reopening. A structured completion summary MUST list outputs/versions, explain the waiting state, and offer explicit confirmation and continued adjustment. Revisions generate a new pending version. Only acceptance of all required deliverables ends the commission.

### Requirement: Restore unconfirmed legacy automatic results
On opening an unarchived expert task completed under automatic policy with not_required deliverables, the runtime MUST restore review and pending acceptance without rerunning tools or changing artifact versions. Already accepted or cancelled tasks MUST remain closed.
