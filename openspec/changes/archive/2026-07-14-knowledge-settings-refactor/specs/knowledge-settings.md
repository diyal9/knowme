# Spec Delta: knowledge-settings

## ADDED Requirements

### Requirement: View concept content

设置知识库页 MUST 允许用户打开概念正文预览。

#### Scenario: Open preview

- **WHEN** 用户点击某概念条目
- **THEN** 显示该概念标题与正文（可读），并可选择实例化为提示词卡片

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
