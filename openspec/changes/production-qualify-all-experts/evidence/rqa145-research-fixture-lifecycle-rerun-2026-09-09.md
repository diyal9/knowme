# RQA145：研究专家隔离生命周期与公开网络路线重放

日期：2026-09-09

## 目的

在隔离 Electron 用户数据和本地研究夹具中，验证研究专家的通用运行时是否能闭环处理本地材料分析、公开网络搜索与原文读取、取消重试、退回修改和验收后重开。

## 执行范围

- 入口：`scripts/expert-qualification-live.js`
- 题集：`skill-evals/rqa74-research-qualification/evals.json`
- Provider：本地 `qualification-research-fixture`，不代表真实网络或生产模型
- Web 工具：通过 `KNOWME_TEST_WEB_FIXTURE_ENDPOINT` 将 `search_web`、`fetch_web_page` 映射到本地研究夹具
- 用户数据：隔离目录 `.tmp/qualification-rqa74-current`
- 安全边界：未使用生产用户数据或真实凭据；资格运行不会自动完成专业断言评审

## 结果

| 指标 | 结果 |
|---|---:|
| 总用例 | 7 |
| 生命周期通过 | 7/7 |
| 运行时失败 | 0 |
| 环境阻塞 | 0 |
| 运行时进入 `needs_input` | 0 |
| 取消/重试 | 1 |
| 退回修改 | 1 |
| 验收后重开 | 1 |
| 独立语义评审待处理 | 7 |
| 专业资格通过 | 0 |

覆盖用例：`RA05` 至 `RA11`。其中 `RA09` 命中 `public-fact-check`，`RA10` 命中 `public-web-research`，`RA11` 命中知识整理路线；所有用例均完成 Electron 隔离重放。

## 结论

本次结果证明研究专家相关路由在本地同构环境中的运行时闭环可用，包括公开网络工具调用协议和异常生命周期处理。

该结果不等于真实公开网络可用性、来源真实性或专业质量通过。真实网络环境、独立断言评审以及生产执行证据仍需单独验收，因此 `professionallyQualified=0`，不能据此将 `productionReady` 标记为通过。

报告：`.tmp/qualification-rqa74-current/qualification.json`。
