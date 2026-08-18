## ADDED Requirements

### Requirement: Workbench home experts are bound production agents

工作台「快捷专家」MUST 只展示用户已添加到当前工作台的专家，MUST NOT 把专家库全部精选包、测试专家或 QA 复制件当作工作台入口。

#### Scenario: Unbound catalog experts stay off the home grid

- **WHEN** 专家库已安装精选专家，但用户未将其「添加到工作台」
- **THEN** 快捷专家不出现这些条目，并展示引导去专家库添加的空状态

#### Scenario: Test experts never appear on the home grid

- **WHEN** 存在 id 为 `test1` / `qa-copy-*` 或说明含「测试用」的专家，即使已被绑定
- **THEN** 快捷专家不展示这些条目

### Requirement: Workflow shelf defaults to real supply only

工作流货架默认 MUST 只汇集个人编排、仓库投影与管线服务目录，MUST NOT 在加载时自动注入内置官方参考工作流包，也 MUST NOT 为这些参考包自动安装专家。

#### Scenario: Fresh load without personal or daemon workflows

- **WHEN** 用户打开工作流货架，且没有个人副本、仓库流或管线目录
- **THEN** 货架不出现 `official-office-meeting-loop` 等内置参考卡
