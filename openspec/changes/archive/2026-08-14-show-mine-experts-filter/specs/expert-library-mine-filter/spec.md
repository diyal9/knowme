## ADDED Requirements

### Requirement: 专家库提供「我的」场景筛选

专家库「按场景浏览」SHALL 在专家 tab 提供名为「我的」的筛选芯片，位置在场景类目（办公/写作/研发/知识）之后。

#### Scenario: 用户浏览我创建的专家

- **WHEN** 用户在专家 tab 点击「我的」
- **THEN** 列表仅展示用户新建或复制保存的专家（source 为 local 或 custom，且无 repositoryId）
- **AND** 不展示 curated / pack / official 精选专家
- **AND** 不展示 Cursor 仓库 / ZIP / HTTPS 等外部导入专家
- **AND** 精选区块隐藏，标题呈现「我创建的专家」

### Requirement: 新建专家保存后进入能力目录

系统在保存本地专家成功后 SHALL 将其登记为已安装能力，使其出现在能力 Hub 列表中。

#### Scenario: 新建专家后可见

- **WHEN** 用户通过新建/复制保存专家且保存成功
- **THEN** install store 与 catalog overlay 包含该专家 id
- **AND** `capability-list`（kind=expert）包含该专家
- **AND** 专家库 UI 切到「我的」筛选并可打开详情

### Requirement: 历史未登记专家仍可列出

`capability-list` SHALL 合并 capabilities 目录下已落盘但未登记的专家。

#### Scenario: 仅有 EXPERT.md 的孤儿专家

- **WHEN** 专家目录存在有效 EXPERT.md 且 install store / overlay 无该 id
- **THEN** 列表仍返回该专家（source 视为 custom）
