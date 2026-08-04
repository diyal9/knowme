# 测试报告：office-partner-grounded-connectors

> 范围：「即需即授（just-in-time incremental authorization）」切片（任务 #2/#3/#9）。GitHub/网页内容源、润色链路等任务未实现，未纳入本次 QA。

- 日期：2026-08-03
- 测试角色：tester
- 依据：`qa-plan.md`（Anti-pattern Checks / Regression 项）

## 自动化结果

- `npm test`：**PASS**（726/726）
- `npm run lint`：**PASS**（含 `script-scope ok`）
- 定向：`node --test tests/feishu-grounding.test.js tests/feishu-cli.test.js` PASS

## 反模式 / 边界压测（8/8 PASS）

| 用例 | 期望 | 结果 |
|---|---|---|
| AP-1 空工具结果 | 提示"未拿到工具返回"，不误弹 scope 授权 CTA | PASS |
| EDGE-2 notFound + scope 文本共存 | "文档不存在"优先，不弹授权 | PASS |
| EDGE-3 妙记 ACL 拒绝 | 走妙记权限申请路径，不误判为缺 scope | PASS |
| EDGE-4 403/unauthorized 无可解析 scope | 提供**通用重新授权**，不落"会议/妙记"错误措辞 | PASS（本轮修复） |
| CORE 有 missing_scopes | 输出编码 scope 的一键增量授权 CTA | PASS |
| REG-1 search_docs 命中 | 不误报授权/阻断 | PASS |
| REG-2 doc_kb_suggest 成功 | 空 hint，不阻断 | PASS |
| EDGE-5 多来源 scope | 结构化+文本去重合并 | PASS |

## QA 期间发现并修复的缺陷

- **DEF-1**：`read_doc` 因 401/403/unauthorized 失败、但 lark-cli 未回传结构化 scope 时，`buildReadFailureNotice` 落到"会议读取失败"通用兜底——对文档读取却提"会议/妙记"，且不提供重新授权入口。
  - 修复：在 `buildReadFailureNotice` 增加 `evidence.authFailed` 分支，回退到通用重新授权 CTA。
  - 回归测试：`tests/feishu-grounding.test.js` 新增用例覆盖该边界。

## Anti-pattern 项对照（qa-plan #23-25）

- [x] #23 不把"工具未授权"与"本轮缺少正文证据"混成同一句（AP-1 / EDGE-4 验证）
- [x] （切片内）无权限不把检索片段写成已确认事实 —— 无权限一律阻断/引导授权，不编造正文
- [n/a] #24/#25 网页/GitHub、润色去 AI 味：相关功能未实现，不在本切片

## 结论

「即需即授」切片 QA **通过**；QA 中发现的 DEF-1 已修复并补回归测试。change 其余任务未实现，整体不进入 `/story-done`。
