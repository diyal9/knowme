# QA Plan — fix-studio-orphan-expert-save

## Smoke Scope

- 打开含失效专家的个人工作流 → 节点显示失效 → 改绑现存专家 → 保存成功并离开
- 删除自建专家后，依赖它的个人工作流引用被清空
- 故意保存失效绑定 → toast 为可读中文而非 `无法解析 member agentPackageId` 原句独占

## Anti-patterns

- 失效下拉空白导致用户以为未绑定却保存仍带旧 id
- 删除专家后工作流静默消失
