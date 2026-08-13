## MODIFIED Requirements

### Requirement: Run view three-stage takeover

从货架启动后 MUST 进入接管式运行视图，包含且仅包含三个阶段：确认输入、执行中、产物。运行视图 MUST 始终显示当前所处阶段。运行视图 MUST 提供回到货架的退路，且该退路 MUST NOT 依赖顶栏「返回货架」按钮；退路 MAY 是底栏「返回流程 / 返回工作台」、确认输入「取消」、或货架上「进行中运行」入口。确认输入阶段 MUST 依据工作流的 `inputs` 生成表单，并展示将参与的 Agent 与实际使用的执行后端（若可解析）。

运行视图在执行中或产物阶段 MUST 在顶栏副说明行展示唯一的任务结论 Status（排队/执行中/等待你/已完成/失败/已取消之一，或其产品等价短标签），且该结论 MUST NOT 仅靠阶段步进条表达；Status MUST 与副说明同级排版（不得与工作流标题同字重/同行对齐成标题级徽章）。右栏运行 meta 与步骤摘要 MUST 展示节点向进度（当前节点与步数/进度），MUST NOT 复制一份与 Status 同词的全局失败/完成结论作为副标题主句。审阅分区 Tab MUST NOT 渲染「推荐」角标；推荐提示 MAY 仅出现在 Tab 下方 meta 文案。

#### Scenario: User can leave run without top-bar shelf back control

- **WHEN** 用户处于确认输入、执行中或产物任一阶段
- **THEN** 顶栏不渲染带「返回货架」文案的返回按钮
- **AND** 用户仍可通过底栏返回或货架进行中入口回到货架，且进行中运行不被无故中断

#### Scenario: Task outcome pill is the single global status

- **WHEN** 工作流运行处于失败终态且阶段仍为「执行中」
- **THEN** 顶栏步进可保持在执行中阶段
- **AND** 顶栏副说明行 Status 显示失败类短标签，并与进度/降级说明同一行对齐
- **AND** 右栏 meta 显示节点或进度摘要而非单独再写「执行失败」作为主结论

#### Scenario: Review tabs stay plain labels

- **WHEN** Daemon 审阅面推荐查看「步骤」
- **THEN** 「步骤」Tab 仅为纯文字标签，不附带「推荐」角标
- **AND** Tab 下方 meta 仍可提示推荐查看对应分区

#### Scenario: Node progress stays in the review rail

- **WHEN** Daemon 运行存在可投递的步骤节点
- **THEN** 步骤 Tab（或右栏 meta）展示当前节点与完成步数类进度摘要
- **AND** 各步骤行保留 per-node 状态色点
