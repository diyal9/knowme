# 代码评审：office-partner-grounded-connectors

> 本文覆盖「即需即授（just-in-time incremental authorization）」切片。change 其它任务（GitHub/网页内容源、润色链路增强）尚未完成，另行评审。

- 日期：2026-08-03
- 评审范围：飞书 `missing_scopes` 检测 → 对话内一键增量授权 → 授权后自动续跑

## 变更清单

| 文件 | 变更 | 说明 |
|---|---|---|
| `src/main.js` | 工具失败结果 `toolMessages` 增补 `code` / `missingScopes` | 让 grounding 拿到结构化权威信号，防文本截断丢失 |
| `src/lib/feishu-grounding.js` | 新增 `extractScopesFromText` / `collectMissingScopes`；`analyzeFeishuToolEvidence` 返回 `missingScopes`；`buildAuthFailureNotice` 改为 scope 感知；接入 4 个 authFailed 分支 + `buildReadFailureNotice` | 优先结构化字段、回退解析 `required scope(s)` 与 `missing_scopes`；友好能力名 + CTA 编码 scope |
| `src/workspace-agent.js` | CTA 重写支持 `?scopes=` 查询串；按钮携带 `data-feishu-scopes` + 可展开「查看所需权限」；点击按增量 scope 拉起授权、成功后自动续跑 | 端到端贯通 |
| `src/workspace.html` | `.feishu-auth-cta-scopes` 样式 | 可展开原始 scope 列表 |
| `tests/feishu-grounding.test.js` | +6 用例 | scope 提取/结构化优先/CTA 编码/scope 感知与回退/read 失败 CTA |

## 评审要点

- **正确性**：优先使用 lark-cli 权威 `missing_scopes`（结构化字段），文本解析仅作回退；避免此前"权限镜像与真实 scope 不同步"的根因。
- **最小权限**：CTA 只编码本次缺失的 scope，授权走增量而非全量重授。
- **不编造边界**：无权限时仍走阻断文案，不伪造正文；与既有 grounding 反编造规则一致。
- **安全**：CTA scope 经 `encodeURIComponent` 编码、渲染侧 `escHtml` 转义，无注入面；`knowme://feishu/auth` 自定义协议仅触发本地授权流程。
- **依赖**：`feishu-grounding.js` 通过 lazy `require('./connectors/feishu-auth')` 引用 `describeScopeCapabilities`，保持该纯函数模块无加载期副作用。
- **回退**：无 scope 信息时退回原「重新授权飞书」通用文案，行为向后兼容。

## 风险 / 遗留

- 手动冒烟（真实飞书缺权限场景）由制作人验收阶段执行，见 `acceptance.md`。
- 授权「进度可视化」（阶段化时间线）为后续增强，不在本切片范围。

## 结论

硬门禁（test + lint）通过；代码符合最小权限与不编造边界原则。可进入制作人验收。
