# RQA154：资格报告导出候选正文

日期：2026-09-09

## 修正

`expert-qualification-live` 原先只导出 `resultSummary`、字符数和会话摘要，独立评审拿不到实际交付正文。现在从隔离 QA 会话的 canonical `session.run.artifacts` 导出 `reviewEvidence.artifacts`：

- `answer`、`document`、`markdown`、`text` 类型保留最多 120,000 字符正文；
- 保留 artifact id、标题、类型、状态、正文长度和是否截断；
- 图片等二进制成果不把 payload 写入 JSON，只保留可审计的路径/元数据；
- 没有改变产品运行时的完成协议，也没有把正文导出当作专业质量通过。

## 实际重放

隔离 Electron 重跑产品经理 `PM01`：

- lifecycle：`1/1` passed
- runtime failure：`0`
- environment blocked：`0`
- `reviewEvidence.artifacts[0].type`：`answer`
- `reviewEvidence.artifacts[0].bodyChars`：`419`
- `truncated`：`false`

报告：`.tmp/qualification-rqa154-pm01/qualification.json`

该候选正文仍是本地文本夹具的占位式摘要，因此本轮只证明“专业评审所需证据现在可取得”，不提高 `professionallyQualified`，也不替代真实模型与独立语义评审。

## 回归

资格 CLI 定向测试：`14/14` passed；`git diff --check` exit `0`（仅保留工作树既有 CRLF 转换提示）。

