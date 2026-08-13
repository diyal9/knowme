# 开发自测报告

- 日期：2026-08-12
- Change：decouple-studio-specialty-from-expert-bind
- npm test: **PASS**（1704/1704）
- npm run lint: **PASS**
- 闭环单测: `tests/studio-component-closed-loop.test.js` **PASS**

## 组件闭环覆盖（自动化）

| 范围 | 结果 |
|------|------|
| 调色板 9 组件 | PASS |
| N1/N2/N3/N8 specialty 无专家编译 | PASS |
| N4 专家必绑 Package | PASS |
| N5 条件真假分支 | PASS |
| N6/N7 汇合 + 人工确认 | PASS |
| E1 成环拒绝 | PASS |
| E2–E7 类型化错误（非 missing_agent） | PASS |
| E10 旧 agentPackageId 残留 | PASS |
| Runner llm→tool 执行 | PASS |

## 手动冒烟路径（开发）

1. 编排工作流 → 大模型：选 Hub/Auto 模型 + Prompt → 保存（不应要求专家）
2. 工具仅选 Skill、知识库仅选库 → 保存
3. 专家不选 Package → 拦截
4. 测试运行：纯 specialty 链不应报「需要绑定本地专家」

## 备注

- Specialty 编译为一等 `llm|tool|knowledge` runtime 节点
- 主进程 `specialtyHandlers`：llm→`chatCompletionOnce`；tool→skill 绑定摘要；knowledge→`fabricRetrieval.kbQuery`
- Electron 真机截图待制作人验收补齐 `evidence/screenshots/`
