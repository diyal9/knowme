# 单专家委托生命周期

## ADDED Requirements

### Requirement: Unified lifecycle
系统 SHALL 为单专家委托提供待开始、执行中、等待中、已结束四个统一阶段；已结束 SHALL 区分已完成、未完成、已取消。

#### Scenario: Automatic completion
- WHEN 所有必需交付物与执行条件已满足，且没有待应用补充
- THEN 系统自动结束委托，不要求接受成果，也不记录用户已接受

#### Scenario: Human review
- WHEN 用户在开始前明确选择交付后审阅
- THEN 条件检查通过后进入等待中，直到用户接受所需成果

#### Scenario: Missing evidence
- WHEN 必需工具或交付证据不足
- THEN 不得自动完成；展示可执行的恢复动作

#### Scenario: Multiple deliverables
- WHEN 仅完成第一项必需交付
- THEN 继续剩余交付，全部满足后才结束

#### Scenario: Follow-up
- WHEN 已结束委托需要重新执行或新增目标
- THEN 建立关联新委托，保留原委托的结束记录

#### Scenario: Legacy records
- WHEN 打开没有完成策略的旧待验收记录
- THEN 保留原审阅状态，不替用户接受旧成果
