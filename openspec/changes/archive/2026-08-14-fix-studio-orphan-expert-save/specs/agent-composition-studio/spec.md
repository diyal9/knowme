## ADDED Requirements

### Requirement: Orphan expert binding is visible and rebindable

当专家节点的 `agentPackageId` 在本地专家目录中不存在时，编排工作室 MUST 在执行专家选择器中展示带「已失效」标记的选项，并允许用户改选仍存在的专家。

#### Scenario: Show stale expert in select

- **WHEN** 草稿节点绑定已删除专家 id，且该 id 不在候选列表
- **THEN** 执行专家下拉 MUST 包含该 id 的「已失效」选项且为当前选中项

#### Scenario: Rebind to existing expert

- **WHEN** 用户将失效绑定改选为现存专家并保存
- **THEN** 保存 MUST 通过 Agent Graph 校验（在其余字段合法时）

### Requirement: Readable unresolved expert save error

保存或「保存后离开」时，若 plan 因无法解析 member / node `agentPackageId` 失败，工作室 MUST 向用户展示可读中文提示，说明专家已删除或不存在，并引导重新选择；MUST NOT 仅展示原始 `无法解析 member agentPackageId` 技术句（可附带 id）。

#### Scenario: Save with deleted expert

- **WHEN** 用户保存仍引用已删除专家的编排草稿
- **THEN** toast / 错误文案 MUST 说明需重新选择执行专家，并包含该专家 id
