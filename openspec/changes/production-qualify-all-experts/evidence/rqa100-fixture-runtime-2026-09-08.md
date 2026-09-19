# RQA100：本地确定性夹具运行时闭环

日期：2026-09-08

## 结论

本轮验证了 KnowMe 通用专家运行时的任务生命周期、失败闭环和交付物协议，但没有把夹具响应当作专家专业能力认证。所有夹具报告仍标记为 `pending_independent_review`，`professionallyQualified` 为 0。

## 结果

| 专家/夹具 | 案例 | 生命周期通过 | 环境阻塞 | 结论 |
| --- | ---: | ---: | ---: | --- |
| 生图专家·本地 MCP | 5 | 5/5 | 0 | 图片工具成功、无图失败、取消重试、退回修改、验收后重开均有回执；生成图片为 1×1 PNG，仅用于协议测试 |
| 产品经理·本地文本 Provider | 6 | 6/6 | 0 | 运行时闭环通过，专业语义待独立评审 |
| 数据分析·本地文本 Provider | 6 | 6/6 | 0 | 运行时闭环通过，专业语义待独立评审 |
| 办公协作·本地文本 Provider | 4 | 4/4 | 0 | 运行时闭环通过，专业语义待独立评审 |
| 软件工程·本地文本 Provider | 1 | 1/1 | 0 | 运行时闭环通过，专业语义待独立评审 |
| 研究分析·本地文本 Provider | 4 | 1/4 | 3 | 3 个案例按合同停在 `needs_input/capability_unavailable`，因为缺少 `search_web`；不能用无检索夹具伪造来源证据 |

原始报告：

- [生图夹具报告](./rqa100-image-fixture-live-2026-09-08.json)
- [产品经理报告](./rqa100-product-manager-fixture-live-rerun-2026-09-08.json)
- [数据分析报告](./rqa100-data-analyst-fixture-live-rerun-2026-09-08.json)
- [办公协作报告](./rqa100-office-partner-fixture-live-rerun-2026-09-08.json)
- [软件工程报告](./rqa100-software-engineer-fixture-live-rerun-2026-09-08.json)
- [研究分析报告](./rqa100-research-analyst-fixture-live-rerun-2026-09-08.json)

## 边界

- 本地文本 Provider 只验证 OpenAI 兼容响应、质量复核 JSON 合同和通用生命周期，不验证事实正确性、专业推理或领域交付质量。
- 生图 MCP 夹具验证真实工具调用、图片字节落盘、预览交付及修改/重开链路；夹具图片是最小 PNG，不代表生图质量、预览视觉质量或真实连接器稳定性。
- 研究专家的 `search_web`、`fetch_web_page` 是能力合同中的必需工具。缺少时停在 `needs_input` 是预期的安全行为，后续必须在有授权的真实或等价本地检索工具环境中复验。

## 基础设施自检

新增文本夹具的两个合同测试通过：普通文本响应和质量复核严格 JSON 响应。定向命令：

```text
node -r ./scripts/register-ts.js --test tests/qualification-text-fixture-server.test.js tests/expert-qualification-live.test.js
13 passed / 0 failed
```
