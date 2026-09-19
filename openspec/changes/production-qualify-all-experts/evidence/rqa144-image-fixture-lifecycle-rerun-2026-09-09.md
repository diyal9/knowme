# RQA144：生图专家隔离生命周期重放

日期：2026-09-09

## 目的

在不接触生产用户数据、不使用真实 Provider 凭据的前提下，重放生图专家的完整任务生命周期，确认通用 Agent 运行时能够处理正常执行、补充输入、取消重试、退回修改以及验收后重开等状态迁移。

## 执行范围

- 资格入口：`scripts/expert-qualification-live.js`
- 题集：`skill-evals/rqa100-image-fixture-qualification/evals.json`
- 连接器：本地 `qualification-image-fixture` MCP，安装并配置 `pango-image-mcp`
- Provider：本地资格夹具（`qualification-fixture`），不是 Pango 生产服务
- 用户数据：隔离目录 `.tmp/qualification-rqa100-current`
- 安全边界：`KNOWME_TEST_SEAM=true`、`productionDataProtected=true`、`automaticProfessionalAcceptance=false`

## 结果

| 指标 | 结果 |
|---|---:|
| 总用例 | 5 |
| 生命周期通过 | 5/5 |
| 运行时失败 | 0 |
| 环境阻塞 | 0 |
| 需要用户输入 | 1（按预期进入 `needs_input`） |
| 取消/重试 | 1 |
| 退回修改 | 1 |
| 验收后重开 | 1 |
| 独立语义评审待处理 | 5 |
| 专业资格通过 | 0 |

用例 `FIXTURE-IP01` 至 `FIXTURE-IP05` 均完成 Electron 隔离重放。各用例状态分别覆盖：正常验收、需要输入、取消后重试、请求修改、验收后重开。

## 结论

本次结果证明生图专家在本地同构环境中的通用任务生命周期已闭环，且失败/补充输入/重试/修改/重开路径没有出现运行时崩溃或环境阻塞。

该结果**不等于**真实图片质量或生产 Provider 资格通过：真实 Pango 仍需在线并取得成功执行回执，生成图片还必须经过独立专业评审。因此 `professionallyQualified=0`，不能据此将 `productionReady` 标记为通过。

报告：`.tmp/qualification-rqa100-current/qualification.json`。
