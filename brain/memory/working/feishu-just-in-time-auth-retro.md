# Retro: feishu-just-in-time-auth

- 日期：2026-08-03
- 归档：`openspec/changes/archive/2026-08-03-feishu-just-in-time-auth/`
- 来源：从 `office-partner-grounded-connectors` 拆分的独立可交付切片

## 背景 / 根因

用户报「点查看知识库→个人文档失败，之前能用」。根因不是"没工具"，而是**工具投影与后置提示之间断层**：lark-cli 已回传权威 `missing_scopes`（如 `space:document:retrieve`），但 `normalizeCliErrorMessage` 把它泛化成"检查不到工具"，系统丢弃了结构化信号 → 用户只能去设置页全量重授。

## 做法（Route A：复用 lark-cli device flow）

- 检测层：`feishu-cli.js` 解析结构化 `missing_scope`，`executeFeishuRead` 返回 `code`+`missingScopes`。
- 贯通：`main.js` 的 `toolMessages` 保留 `code`/`missingScopes`（防文本截断丢信号）。
- 接地：`feishu-grounding.js` `collectMissingScopes` + scope 感知 `buildAuthFailureNotice`（友好能力名 + `knowme://feishu/auth?scopes=` 编码），4 个 authFailed 分支与 read 失败全接入。
- 授权：`feishu-auth.js` `buildAuthLoginAttempts(extraScopes)` 增量授权、`describeScopeCapabilities` 友好名。
- 渲染：`workspace-agent.js`/`workspace.html` CTA 解析 `?scopes=`、可展开原始 scope、点击增量授权、成功后自动续跑原始提问。

## 复用经验（可沉淀）

1. **别丢底层工具的结构化错误**：CLI/SDK 报的 `missing_scopes`、`code` 要一路带到用户可见层，泛化=丢信号。
2. **最小权限即需即授**：CTA 只编码本轮缺失 scope，走增量授权，比"跳设置全量重授"体验好一个量级。
3. **失败措辞要按失败类型分流**：notFound / 妙记 ACL / 缺 scope / 泛化 401·403，各有专属提示，别互相错配（QA 抓到的 DEF-1：doc 403 无 scope 时误落"会议读取失败"）。
4. **诚实拆分**：切片完成但父 change 未完时，拆独立 change 单独归档，父 change 的验收/证据同步剥离，避免虚假完成。

## 门禁

开发自测 ✅ / 制作人验收 ✅ / 测试 QA ✅（DEF-1 已修+回归）/ `/gate-check` 硬项 ✅（726 tests + lint）。

> 若同类"底层结构化错误被泛化"缺陷再复发 ≥3 次，考虑 `/evolve` 升 Skill。
