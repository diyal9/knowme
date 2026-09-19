# 测试报告：Brain 工作区与外部知识库

日期：2026-08-27

## 结果

| 检查 | 结果 |
|---|---|
| `tests/brain-service.test.js` | 15/15 通过 |
| `knowledge.spec.tsx` | 15/15 通过 |
| Provider / 密钥回归 | 17/17 通过（多 LLM Wiki、RAGFlow 协议、明文隔离、DPAPI 契约） |
| `npm run typecheck:renderer` | 通过 |
| `npm run typecheck:lib` | 通过 |
| `npm run brain:migration:audit` | 通过；幂等，来源未改，外部概念泄漏为 false |
| Playwright 1280×800 | 通过；Brain、知识库、RAG 三页截图，page error 0 |
| RAGFlow 实际目录同步 | 通过；读取 16 个 Dataset 元数据，默认授权 0 个 |
| OpenSpec strict validation | 通过 |

## 全量门禁说明

`npm run check` 已完成 Node 全套测试（1823 通过、51 跳过、0 失败）和 lint；知识页 15/15 通过，本 change 的旧 IA 断言已同步修正。其余 2 个失败来自当前脏工作区中的专家工作台字体契约与能力中心交互契约，不在本 change 范围，因此未擅自修改。

结论：本次 Brain、多个 LLM Wiki 与 RAGFlow 改动的定向测试、类型检查、迁移审计与真实浏览器验收均通过；仓库级硬门禁仍被上述 2 个无关既有问题阻塞。
