# Code Review — fix-agent-tool-surface-truncation

## 范围

- `src/lib/agent-tools.js`：投影预算 + 优先级 + warn
- `src/lib/tool-surface-builder.js` / `src/lib/connectors/tool-runtime.js`：传递 requiredTools
- `src/main.js`：前置失败收敛终态；成功路径 `completed` + 回传 text
- `src/workspace-agent.js`：v2 失败展示可执行错误
- `tests/agent-tools.test.js`：超预算保留连接器 / 必需工具

## 结论

**通过（可合并本 Story）**

- 根因修复明确：不再静默截断飞书工具
- 失败路径对用户可读
- 冒烟证明 `feishu.doc_kb_suggest` 真调用成功且 Run 终态 done
- 未见密钥泄露或危险命令引入

## 遗留（非本 Story 阻塞）

- 工具面预算仍是硬上限；远期可做按需投影 / 语义检索
- 编排工具在极端超限时会被优先裁掉（符合本 Story 优先级约定）
