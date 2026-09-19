# RQA64 产品发现角色合并

## 结论

产品发现分类不再维护三个并列专家。`product-manager` 是保留专家；`user-researcher` 与 `requirement-reviewer` 的能力由产品经理的声明式执行模式承接。旧包与旧 expertId 本轮不删除，继续承担历史任务重开和回滚兼容。

这是一项组合迁移证据，不是产品经理生产资格证书。

## 运行契约

- 产品定义任务只加载 `product-definition-method`。
- 明确的用户研究、访谈分析和证据分析任务只加载 `research-evidence-analysis`。
- 明确的需求/PRD 评审任务只加载 `requirement-review`。
- 每条路由可声明独立质量复核；没有路由复核的专家继续使用原包级复核。
- 路由和质量复核均由 manifest 数据驱动，平台没有新增具体 expertId 分支。
- 普通对话成果保持 `answer`；只有任务明确声明文件或媒体成果时才进入 artifact 契约。

## 工作流迁移

官方 `official-product-requirement` 从三个专家依赖改为一个产品经理的三阶段图：用户研究 → 产品定义 → 需求评审。工作流版本升至 2.2.0，`requiredExpertIds()` 不再要求安装两个待退出角色。

## 影响与验证

- `routeContract`：LOW，2 个直接上游。
- `qualityReviewContract`：索引尚未收录该新增文件符号，文本核对只有专家任务执行主链调用。
- `execute`：HIGH，5 个直接调用方、18 个上游、影响 IPC 主执行流程；接线保持向后兼容，且完整专家任务回归通过。
- `listOfficialWorkflowPackages`：MEDIUM，5 个直接调用方；已覆盖官方工作流、工作流供应和目录覆盖测试。
- `requiredExpertIds`：LOW，2 个直接调用方。

验证命令：

```text
node -r ./scripts/register-ts.js --test tests/official-workflows.test.js tests/workflow-supply.test.js tests/skill-catalog-coverage.test.js tests/rqa34-product-research-methods.test.js tests/expert-execution-profile.test.js tests/expert-task-runtime.test.js
```

结果：90 passed，0 failed。

## 未完成

- 两个旧专家尚未从默认目录退出；需要先实现目录兼容状态与升级/回滚验证。
- 尚未用冻结专业题完成产品经理三模式的真实模型、修改轮、失败恢复和重开资格验证。
- 其余 7 个 merge 角色、3 个 skill-only 角色与 1 个 workflow-only 角色仍待迁移。
