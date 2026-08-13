## ADDED Requirements

### Requirement: Expert delete cleans workflow package refs

删除自建专家成功后，系统 MUST 在清理工作模式绑定之外，best-effort 清理个人工作流包中对该专家 id 的引用。

#### Scenario: Delete self-built expert used by personal workflow

- **WHEN** 用户删除自建专家，且某个人工作流仍引用其 id
- **THEN** 该工作流中的专家引用 MUST 被清空；删除结果可报告清理摘要
