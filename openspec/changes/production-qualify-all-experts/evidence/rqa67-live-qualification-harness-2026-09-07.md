# RQA67 — 保留专家真实资格执行框架与首个当前配置结论

日期：2026-09-07

## 结论

- 最终生产资格分母仍为 9 个 lifecycle-active 保留专家；13 个退出角色只做历史兼容审计。
- 建立统一真实生命周期认证入口 `npm run eval:experts:live`。它只采集运行和生命周期证据，不会自动接受普通成果，也不会把 `review` 状态当专业合格。
- 认证入口强制显式隔离 QA userData，拒绝 `%APPDATA%/KnowMe` 及无 `qa/test/qualification/eval` 标记的目录；测试进程可与正式 KnowMe 并行，但正式应用的单实例锁保持不变。
- 产品经理当前配置首题 PM01 未通过：任务 `task-mtrazqs4-1mpu2` 在完整 Agent/Skill/模型配置下，自动修订后仍未通过包声明的专业质量复核，运行时正确拒绝交付并进入 `failed`。
- 当前资格为 0/9：`product-manager` 为 `failed/not_eligible`，其余 8 个保留专家为 `unverified/pending_evidence`。包合同 100 分仅代表结构完整，不能抵消真实失败或缺少运行证据。

## 当前配置身份

- Configuration ID：`expert-config-v2:b7fc634bff640ced480e8b90ce1f8a9027686fe9d3f151b561fd3aa04ac2101b`
- Agent：`product-manager` 2.4.0，hash `113f960780d8bd7e`
- Skills：`product-definition-method`、`requirement-review`、`research-evidence-analysis`、`writing-polish`，均保存独立 hash
- Model：DashScope / `qwen3.8-max`
- 资格上下文合同：v2，字段完整，无 unscoped 样本

## 失败诊断

前一轮同题在旧运行时哈希上观察到五次串行模型请求：首稿 48.6 秒，随后 38.6 秒、20.5 秒、41.8 秒，并在第五次请求中超过套件 180 秒上限。首稿发生长度恢复后，通用编排继续执行完整重写、质量审计和复审，说明一次无工具回答可能膨胀成多次串行调用，且缺少任务级总时限收敛。

当前哈希重跑没有被认证器超时截断，而是由运行时明确返回 `professional_review_failed`：自动修订后的完整答案仍不符合产品经理包声明的事实、状态闭环、可追踪验收和版本一致性标准。该结果同时证明两件事：质量门禁没有伪放行，但当前产品经理能力不配生产专家称号。

## 证据与门禁

- 原始当前运行：`../skill-evals/rqa62-product-manager-qualification/current-live-results.json`
- AgentEvals 输入：`../skill-evals/rqa62-product-manager-qualification/current-live-results-agent-evals.json`
- 9 专家总资格报表：`rqa67-current-qualification.json` / `rqa67-current-qualification.md`
- 认证器专用测试：5/5
- 启动隔离与能力集成组合：25/25
- `npm run check`：exit 0；后端 3615 项（3564 pass / 51 skip / 0 fail），Renderer 86 文件 607 项，lint 与 renderer typecheck 通过。

## 未完成

- 产品经理其余 normal、edge、retry、revision、reopen 样本尚未继续执行；首个硬失败已足以阻止当前配置获资格，但仍需用于整改后的回归。
- 其余 8 个保留专家尚未执行完整当前配置资格套件。
- 通用编排仍需增加任务级模型调用预算与有界质量复核，避免一次回答无界放大成多次串行调用。
- 迁移备份的实际恢复演练仍未完成。

