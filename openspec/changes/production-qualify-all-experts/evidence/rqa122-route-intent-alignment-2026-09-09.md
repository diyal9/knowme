# RQA122：专项资格题与真实 SOP 路由对齐

## 发现

对 RQA121 新增的 `routeId` 用例逐题运行当前路由选择器后，发现 PM07 和 SE12 的题意虽然正确，但没有命中目录中的关键词，实际会回落到默认路线。这意味着只增加 `routeId` 元数据并不足以证明题目会触发专项能力。

## 修正

- PM07 明确写入“需求评审”，命中产品经理的 `requirement-review`。
- SE12 明确写入“架构设计”和“技术方案”，命中软件工程师的 `architecture-decision`。
- 保留生图专家 `pango-generate` 的成果物执行路线契约；该专家没有关键词路线，真实工具证据仍由最终 `executionEvidence.executionRoute` 校验。
- 新增回归：读取保留专家题集和目录能力契约，逐题验证专项题命中声明路线；没有关键词路线的成果物路线必须在 deliverable 上声明一致。

## 验证

`tests/expert-qualification-matrix.test.js`：`6/6` 通过，覆盖条件路线缺失检测、补齐检测和题目到目录路线命中。全量后端回归 `3466/3517` 通过、`51` 跳过、`0` 失败；lint 与 Renderer 类型检查通过。

这项修正只证明路由意图与题集/目录的一致性，不代表真实 Provider、连接器工具回执或专业语义质量已经通过。
