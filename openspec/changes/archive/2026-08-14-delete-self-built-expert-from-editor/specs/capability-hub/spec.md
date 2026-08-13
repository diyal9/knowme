## ADDED Requirements

### Requirement: 自建专家编辑弹窗可删除

编辑自建专家时，系统 SHALL 在编辑弹窗提供「删除专家」入口；创建或复制为自建、以及精选专家的编辑路径 MUST NOT 暴露该入口。

#### Scenario: 编辑自建专家显示删除

- **WHEN** 用户打开 source 为 `local` 或 `custom` 的专家编辑弹窗（tune）
- **THEN** 弹窗底栏显示「删除专家」按钮

#### Scenario: 新建不显示删除

- **WHEN** 用户打开「添加自己的专家」弹窗
- **THEN** 不显示「删除专家」

#### Scenario: 确认后删除并刷新

- **WHEN** 用户在危险确认对话框确认删除
- **THEN** 该专家从本机专家包与目录中移除，工作台绑定被清理，编辑弹窗关闭且目录刷新后不再列出该专家

#### Scenario: 精选不可通过删除 API 移除

- **WHEN** 调用 `expert-delete` 的目标 source 为 `curated` / `pack` / `official`
- **THEN** 操作失败且专家包仍保留
