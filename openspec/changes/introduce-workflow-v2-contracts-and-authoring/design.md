# Design
Manifest v3 reader 接受 v2 并写出 v3。Action 声明结构化 I/O、执行器、权限、风险、副作用、超时、重试与幂等。Workflow v2 使用判别节点并记录边映射、版本锁和发布证据。草稿可真实运行；已发布包通过新草稿演进。

普通指导型 Skill 只装备 Agent。`personal` Agent 被验证器拒绝为节点。v1 `tool` 可包装为 Action，`llm/knowledge` 只以兼容标记读取。
