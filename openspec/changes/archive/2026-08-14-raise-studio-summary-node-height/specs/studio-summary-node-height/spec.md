## ADDED Requirements

### Requirement: Studio summary cards allocate enough height for goal text

工作室画布上的摘要节点（尤其专家 `kind-agent`）SHALL 为「目标」类 `mode-text` 分区预留足够高度，使目标文本框与卡片底边完整可见，不被硬裁切。

#### Scenario: Agent node with expert + goal shows full goal box

- **WHEN** 专家节点同时展示「执行专家」与「目标」摘要
- **THEN** 目标文本框底边与卡片底边完整可见
- **AND** 目标摘要至少可展示约 4 行（超出省略）

#### Scenario: Height stays below former inline-form cards

- **WHEN** 计算含 Prompt/目标的摘要卡高度
- **THEN** 高度仍明显低于历史内联表单卡（保持可扫读）
- **AND** 不超过 `MAX_NODE_H`
