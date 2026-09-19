# RQA101：研究工具合同与安全边界复验

日期：2026-09-08

## 结论

研究分析师依赖的 `search_web` 与 `fetch_web_page` 在通用工具层已具备完整合同、来源回执、失败回执和 SSRF 安全边界；当前 RQA100 的研究专家阻塞来自实时资格夹具没有提供外部检索工具调用，不是把无工具响应误判为成功。

## 证据

定向回归覆盖：

- `search_web`：RSS 解析、去重、时间窗口、来源元数据、无效响应、HTTP 错误、超时。
- `fetch_web_page`：正文提取、安全跳转、私网/环回拦截、非文本类型、超大响应、超时和失败回执。
- `research-routing`：只在工具实际投影且用户明确要求公开研究时建立检索任务；工具未投影时不虚构检索义务。
- `agent-run-executor-grounding`：缺少必需搜索证据时阻断当前新闻结论；有成功工具证据时才允许继续。

定向命令结果：

```text
node -r ./scripts/register-ts.js --test tests/web-search.test.js tests/web-fetch.test.js tests/research-routing.test.js tests/rqa19-research-routing.test.js tests/agent-run-executor-grounding.test.js
84 passed / 0 failed
```

## 当前边界

本地 RQA100 文本 Provider 仍不能模拟真实工具调用，因此研究专家的 RA05、RA06、RA07 在该环境中按合同进入 `needs_input/capability_unavailable`。这项结果保留为真实资格缺口，不通过增加专家特判或伪造网页结果来掩盖。

要关闭研究专家生产资格，还需要在允许网络访问或等价隔离检索服务的环境中重新执行 RQA74，并核验真实搜索回执、原文读取、来源日期、取消重试、退回修改和验收重开。
