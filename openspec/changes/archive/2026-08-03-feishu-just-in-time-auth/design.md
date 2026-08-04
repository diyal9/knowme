# Design: feishu-just-in-time-auth

## 进程边界

| 层 | 文件 | 职责 |
|---|---|---|
| 主进程·工具执行 | `src/lib/connectors/feishu-cli.js` | 解析 lark-cli 结构化 `missing_scope` 错误（`parseMissingScopeError` / `describeMissingScopes` / `getGrantedUserScopes`），`executeFeishuRead` 优先返回 `code:'missing_scope'` + `missingScopes` |
| 主进程·授权 | `src/lib/connectors/feishu-auth.js` | `buildAuthLoginAttempts(extraScopes)` 增量授权；`describeScopeCapabilities(scopes)` 映射友好能力名；`startFeishuAuth(opts.scopes)` |
| 主进程·编排 | `src/main.js` | 工具失败结果 `toolMessages` 携带 `code`/`missingScopes`；`connectors-feishu-auth-start` IPC 透传 `options.scopes` |
| 主进程·接地 | `src/lib/feishu-grounding.js` | 从失败证据提取 `missingScopes`，构造 scope 感知授权 CTA（友好能力名 + `knowme://feishu/auth?scopes=` 编码） |
| 预加载 | `src/preload.js` | `connectorsFeishuAuthStart(options)` 透传 `scopes` |
| 渲染进程 | `src/workspace-agent.js` / `src/workspace.html` | CTA 重写解析 `?scopes=`，按钮携带 `data-feishu-scopes` + 可展开原始 scope；点击按增量 scope 拉起授权，成功后 `runAI({promptText})` 自动续跑 |

## 关键数据流

```
tool fail (feishu-cli 解析 missing_scope)
  → main.js toolMessages{code, missingScopes, text}
  → feishu-grounding analyzeFeishuToolEvidence → missingScopes[]
  → buildAuthFailureNotice(subject, hint, missingScopes)
      · describeScopeCapabilities → 友好能力名
      · buildAuthCtaUrl → knowme://feishu/auth?scopes=<enc>
  → 渲染层重写为一键授权按钮(data-feishu-scopes)
  → 点击 → connectorsFeishuAuthStart({scopes}) 增量授权
  → 成功 → runAI({promptText: pendingPrompt}) 自动续跑
```

## 取舍

- **结构化优先、文本回退**：优先用 lark-cli 的 `missingScopes` 字段，回退解析 `required scope(s):` 与 `"missing_scopes":[]`，避免文本截断丢信号。
- **lazy require**：`feishu-grounding.js` 通过 `require('./connectors/feishu-auth')` 惰性引用 `describeScopeCapabilities`，保持纯函数模块无加载期副作用。
- **最小权限**：CTA 只编码本轮缺失 scope，走增量授权。
- **不编造边界**：无权限一律阻断/引导授权，绝不伪造正文；与既有 grounding 反编造规则一致。
- **优先级顺序**（`buildReadFailureNotice`）：notFound > 妙记 ACL > 有结构化 scope 的增量 CTA > 泛化 401/403 的通用重新授权 > 通用兜底。
