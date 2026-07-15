# knowledge-settings Specification

## Purpose

设置页知识库：浏览、按主题导出 OKF。

## Requirements

### Requirement: View and edit concept content

设置知识库页 MUST 允许用户打开概念正文，并编辑标题/正文后保存。

#### Scenario: Open preview

- **WHEN** 用户点击某概念条目
- **THEN** 显示可编辑的标题与正文，并可选择实例化为提示词卡片

#### Scenario: Save edit

- **WHEN** 用户修改正文并点击保存
- **THEN** 磁盘概念更新且再次打开可见更改

### Requirement: Skill pack category

知识库 MUST 支持 `skills`（技能包）主题目录，用于同主题封装生成的技能文档。

#### Scenario: List skills

- **WHEN** 用户已封装技能包
- **THEN** 主题列表出现「技能包」且可打开对应文档
### Requirement: Selective category export

用户 MUST 能按知识主题（分类）勾选后导出 OKF 包；勾选全部主题时 MUST 等价于导出整库。

#### Scenario: Export one theme

- **WHEN** 仅勾选「概念」并导出成功
- **THEN** 目标包内概念均属于 concepts，且 OKF lint 通过

#### Scenario: Export all selected

- **WHEN** 勾选全部分类并导出
- **THEN** 导出概念数与知识库总数一致

### Requirement: Concise knowledge UI copy

知识库页说明文案 MUST 精简，不以长段路径/多行说明占据首屏。
