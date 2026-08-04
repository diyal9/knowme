# Delta Spec — workspace（任务工作间右栏可读性）

## ADDED Requirements

### Requirement: 任务工作间状态区必须以用户可读的结论呈现

任务工作间右栏的「当前状态」区 SHALL 以一句用户向结论（headline）加简短说明呈现，MUST NOT 将用于 LLM 上下文注入的 `factualBrief` 多行事实串原样渲染到界面。状态区、进度标签与顶部 meta 三者对同一任务 SHALL 表达一致的状态语义，禁止同屏出现「流程执行中」与「已完成」相互矛盾的表述。

#### Scenario: 任务已完成

- **WHEN** 任务状态为 `done` 且无待审批/待澄清节点
- **THEN** 状态区结论显示「任务已完成」，顶部 meta 显示「已完成」而非「流程执行中」
- **AND** 界面不出现内部规则文案（如「禁止把任务输入路径当作产物…」）

#### Scenario: 等待本机审批

- **WHEN** 存在 pending gate
- **THEN** 结论显示「等待你确认」并使用等待语义色（非成功绿）

#### Scenario: 流程详情降级

- **WHEN** 工作流节点无法加载（degraded）
- **THEN** 降级说明 MUST NOT 暴露 workflow id 或 `.cursor/workflows/` 等实现路径
- **AND** 「参与助手」区仅显示一句简短降级提示，不与「执行节点」重复完整原因

### Requirement: 语义色仅将绿色用于成功

任务工作间的状态色 SHALL 按语义区分：完成/成功用绿色，等待用琥珀色，执行用中性色，失败用红色，降级用灰色；绿色 MUST NOT 用于非成功状态的进度标签或高亮框。

#### Scenario: 执行中不使用成功绿

- **WHEN** 任务处于执行中或等待态
- **THEN** 进度标签与下一步提示不使用成功绿，避免稀释「完成」的视觉信号
