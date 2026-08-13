## MODIFIED Requirements

### Requirement: Run view three-stage takeover

从货架启动后 MUST 进入接管式运行视图，包含且仅包含三个阶段：确认输入、执行中、产物。运行视图 MUST 通过内容面表达当前阶段，MUST NOT 在顶栏渲染「确认输入 / 执行中 / 产物」装饰性步进条。运行视图顶栏 MUST 在右侧提供可点击「返回」控件，行为 MUST 回到货架（或任务房退路）且 MUST NOT 无故中断已登记的进行中运行语义；底栏「返回流程 / 返回工作台」MAY 继续作为次要退路。确认输入阶段 MUST 依据工作流的 `inputs` 生成表单，并展示将参与的 Agent 与实际使用的执行后端（若可解析）。

运行视图在执行中或产物阶段 MUST 在顶栏标题旁展示唯一的任务结论 Status Pill（排队/执行中/等待你/已完成/失败/已取消之一，或其产品等价短标签）。右栏运行 meta 与步骤摘要 MUST 展示节点向进度（当前节点与步数/进度），MUST NOT 复制一份与 Pill 同词的全局失败/完成结论作为副标题主句。

#### Scenario: Top bar has back without stage stepper

- **WHEN** 用户处于确认输入、执行中或产物任一阶段
- **THEN** 顶栏不渲染「确认输入」「执行中」「产物」三段步进
- **AND** 顶栏右侧显示可点击「返回」
- **AND** 激活返回后回到货架（或任务房约定退路），进行中运行不被无故中断

#### Scenario: Task outcome pill is the single global status

- **WHEN** 工作流运行处于失败终态且内容面仍为执行中阶段
- **THEN** 标题旁 Status Pill 显示失败类短标签
- **AND** 右栏 meta 显示节点或进度摘要而非单独再写「执行失败」作为主结论

#### Scenario: Node progress stays in the review rail

- **WHEN** Daemon 运行存在可投递的步骤节点
- **THEN** 步骤 Tab（或右栏 meta）展示当前节点与完成步数类进度摘要
- **AND** 各步骤行保留 per-node 状态色点
