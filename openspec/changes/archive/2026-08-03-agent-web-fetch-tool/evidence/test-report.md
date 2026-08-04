# Test Report: agent-web-fetch-tool

- 日期：2026-08-03
- 角色：测试
- 环境：Windows 10 19045 · Node 24 · Electron 31 · 真实公网
- 依据：`qa-plan.md`
- 结论：**PASS**（S1/S2 为 ADVISORY 残余，见下）

## 自动化

| 项 | 结果 |
|---|---|
| `npm test` | PASS — 798 pass / 0 fail / 135 suites（`tests/web-fetch.test.js` 29 条新增） |
| `npm run lint` | PASS |

覆盖：SSRF（IPv4/IPv6/`::ffff:`/DNS 到内网/非 http）、重定向重校验、正文提取与 `&#x27;` 实体解码、超时、2MB 截断、工具注册与提示词分流断言。

## Smoke Scope 执行

| # | 场景 | 结果 | 证据 |
|---|---|---|---|
| S1 | Anthropic 链接写 TechTalk（真机 LLM） | ADVISORY | 工具链路与真实抓取已通；模型选工具需本机 API Key 再点 |
| S2 | 飞书链接仍走 `feishu.read_doc` | ADVISORY | 工具描述 + 提示词双写分流；真机再确认 |
| S3 | `http://127.0.0.1:8080/admin` | PASS | `blocked_target` |
| S4 | 404 链接 | PASS | `http_error` + 404 文案 |
| S5 | PDF 直链 | PASS | `unsupported_content_type` + `application/pdf` |
| S6 | 内容源添加网页 | PASS | `example.com` → `index.md` 可读 |

## 安全抽查

| # | 结果 |
|---|---|
| SEC3 `169.254.169.254` | PASS — `blocked_target` |
| SEC1–SEC7 单测矩阵 | PASS — `tests/web-fetch.test.js` |

## 反模式

| # | 结论 |
|---|---|
| A1–A3 能力否认 / 甩锅 / 幻觉 | 提示词与失败契约已约束；真机模型行为 ADVISORY |
| A4 报错可读 | PASS — 中文错误码文案 |
| A5 截断标注 | PASS — `truncated` + 「正文过长，以下内容已截断」 |
| A6 时间线标题 | PASS — 「正在读取网页 / 网页读取完成」 |
| A7 超时 | PASS — 15s 抓取超时映射 `timeout` |

## 工具链路（绕过 GUI）

- `fetch_web_page` 在连接器工具面注册；公网 URL → 结构化正文；内网 → `blocked_target` 透传
