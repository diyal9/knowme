# RQA121：条件执行路线资格矩阵与运行时路线证据

## 目的

此前矩阵只要求 normal / edge / retry / revision / reopen 生命周期覆盖，不能证明专家的专项 SOP 路线实际被题集覆盖，也不能阻止专项题目最终走默认路线。本轮把条件路线纳入资格门禁，并要求真实任务证据中的 `executionRoute` 与题目 `routeId` 一致。

## 变更

- 资格矩阵从专家能力契约读取非默认的工具、连接器、必需 Skill 路线，以及成果物声明的 `executionRoute`。
- 每条条件路线必须至少有一个题集用例显式声明 `routeId`；缺失时专家状态为 `insufficient_evidence`，不能进入 live execution。
- live qualification 的生命周期检查会从最终任务的 `executionEvidence` 收集实际 `executionRoute`；题目声明路线未被实际选中时用例失败。
- 新增专项资格题：产品经理 2 条、办公协作 4 条、研究分析 3 条、软件工程师 2 条、数据分析师 2 条、生图专家 1 条。

## 静态验证

执行：

```text
node scripts/expert-qualification-matrix.js --out .tmp/rqa121-matrix.json
```

结果：

- 矩阵完整性：`Complete: yes`
- 可进入真实执行资格阶段：`6/6`
- 用例总数：`51`
- product-manager：8，覆盖 `requirement-review`、`user-research`
- office-partner：12，覆盖 `today-priority`、`meeting-summary`、`doc-kb`、`related-chats`
- research-analyst：9，覆盖 `public-fact-check`、`public-web-research`、`knowledge-curation`
- software-engineer：8，覆盖 `architecture-decision`、`quality-verification`
- data-analyst：8，覆盖 `data-report`、`business-insight`
- image-producer：6，覆盖 `pango-generate`

定向回归：资格矩阵与 live qualification 共 `18/18` 通过；覆盖缺失路线被拒绝、补齐路线后通过，以及最终执行路线匹配/不匹配。

全量验证：后端 `3465/3516` 通过、`51` 跳过、`0` 失败；Renderer `86` 文件、`625/625` 通过；lint、类型检查通过。

## 结论与边界

现在可以继续进行 6 个保留专家的真实执行资格测试，且每条条件路线都有明确的专项题和运行时路线一致性门禁。这里的 `ready_for_live_execution` 只表示资格题集完整，不表示专家已生产合格。

当前仍未完成：真实 Provider / 连接器成功回执、成果物质量与独立语义评审。尤其生图的 `pango-generate` 仍受真实环境安全存储和 Pango Provider 可用性约束；在这些回执取得前，`professionallyQualified=0`、`executionReady=false`、`productionReady=false` 必须保持。
