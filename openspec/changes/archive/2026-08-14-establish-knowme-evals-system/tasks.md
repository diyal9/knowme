## 1. 评估框架分层化（L0/L1/L2）

- [x] 1.1 定义三层 suite 元数据与执行入口（hard-offline / self-e2e-controlled / cross-product-benchmark）
- [x] 1.2 保持 `npm test` 的离线硬门禁可运行，避免引入外网依赖
- [x] 1.3 为 nightly/weekly 增加可选执行命令与统一报告落盘规范

## 2. 自我评估（Self-Eval）扩展

- [x] 2.1 扩展 `agent-conversation-eval-harness` 维度：tool success、latency、recovery/cancel 指标
- [x] 2.2 新增/整理场景集（多轮上下文、工具预算冲突、故障恢复、治理拒答）
- [x] 2.3 引入阈值版本机制（在现有 `v1` 基础上新增 `v2` 草案）并记录变更原因
- [x] 2.4 输出可追溯失败归因标签（场景 × 维度 × taxonomy）

## 3. 竞品对比（Cursor/Workbuddy）框架

- [x] 3.1 设计统一 `benchmark adapter` 结果 schema 与标准化流程
- [x] 3.2 实现 KnowMe 适配器（基线），并预留 Cursor/Workbuddy 适配器契约
- [x] 3.3 构建对比任务集（先 10 个核心任务，后续扩展至 30+）
- [x] 3.4 建立同任务同输入同评分的公平性校验

## 4. 报告与门禁集成

- [x] 4.1 扩展 `scripts/agent-eval.js` 或新增 benchmark 脚本，统一输出 JSON + Markdown
- [x] 4.2 报告包含汇总统计（pass rate、latency p50/p90、失败分布）和维度对比
- [x] 4.3 将 L0 纳入硬门禁，L1/L2 初期作为 advisory 并保留升级路径

## 5. 验证与证据

- [x] 5.1 运行 `npm test`、`npm run lint`、评估脚本并记录真实输出
- [x] 5.2 产出 `evidence/eval-report.json` 与 `evidence/eval-report.md`
- [x] 5.3 完成 `acceptance.md`、`qa-plan.md`、`code-review.md` 的执行与结论
