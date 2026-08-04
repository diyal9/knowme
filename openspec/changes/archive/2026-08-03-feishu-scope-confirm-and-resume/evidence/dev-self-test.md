# 开发自测 — feishu-scope-confirm-and-resume

日期：2026-08-03 · 角色：开发

## 命令与结果

| 命令 | 结果 |
|---|---|
| `npm run lint` | 通过，无 error |
| `node --test tests/feishu-auth.test.js tests/feishu-cli.test.js tests/connectors.test.js tests/feishu-grounding.test.js tests/workspace-agent.test.js` | 138 tests / 11 suites 全通过 |
| `node --test tests/feishu-scope-confirm.test.js` | 5 tests 全通过 |
| `npm test`（全量） | 758 tests / 130 suites 全通过 |

> 过程记录：本变更中途一次全量跑曾有 `memory-consolidation` 单例失败（期望 work hint `action === 'fill'`，实际 `undefined`），属在途变更 `simplify-explainable-work-hints` 的范围，本变更未触碰该链路；收尾复跑时已恢复绿色。

## 关键回归点

1. **画像 vs 申请一致性**：`findUnrequestedPermissionCategories()` 返回空，确保不会再出现"判定要求某能力、却从未申请对应 scope"导致的永久缺口。
2. **补充授权真实性**：`scopeSignature` + 缺失类目集合作为基线，只有授权集合真的变化（或缺口缩小）才算成功；否则超时给出点名文案并把按钮降级为「重试补充权限」。
3. **对话内中断可续跑**：`feishu.doc_kb_suggest` 全分区权限失败时返回 `{ ok:false, code:'missing_scope' }`，grounding 层据此产出 `knowme://feishu/auth` 确定性 CTA，授权完成后自动重跑被中断的指令；部分成功时保持 `ok` 并在正文标注受限分区。

## 追加修复：对话内点击授权提示「不允许的协议」

真机复现与定位（`lark-cli` 1.0.77）：

| 验证 | 命令/结果 |
|---|---|
| 基础 scope 列表可发起授权 | `lark-cli auth login --scope <18 项基础列表> --recommend --no-wait --json` → 返回 device_code |
| 运行时发现的 scope 会毒化整轮 | 追加 `knowledge:space:readonly` 等 → `The provided scope list contains invalid or malformed scopes` |
| 逐个探测 | INVALID：`drive:space:readonly`、`knowledge:space:readonly`、`knowledge:node:readonly`、`drive:doc:readonly`、`wiki:space:readonly`、`wiki:node:readonly`、`docs:document:retrieve`；VALID：`wiki:wiki:readonly`、`space:document:retrieve`、`drive:file:readonly` |
| 降级阶梯端到端 | `startFeishuAuth(dir,{scopes:[3 个非法 + 'not a scope']})` → `ok:true`，`dropped:["not a scope"]`，`skipped:[3 个非法]`，返回真实 verification_url |

两处根因：

1. **「不允许的协议」**：`src/main.js` 的 `open-external` 白名单只放行 `http/https/mailto/file`。内联 CTA 走的是 `data-feishu-auth-cta` 按钮（正常），但模型以 `open_link` 结构化建议给出 `knowme://feishu/auth` 时，会经 dispatcher → `handleFeishuLinkAction` → `openExternal`，被主进程拒绝。修复：在 `handleFeishuLinkAction` 顶部拦截该深链，交给抽出的 `runFeishuAuthInChat`，与内联 CTA 同一套「拉起授权 → 等待缺口变化 → 续跑原提问」逻辑；结构化建议没有 CTA 容器，用 `ensureFeishuAuthHost()` 把面板挂到最近一条回复下。
2. **整轮授权被非法 scope 拖垮**：飞书对 scope 列表整体校验。修复：`sanitizeExtraScopes` 先按形态过滤，阶梯第二级回退到已验证的基础列表，并把被丢弃/未申请的权限名回显给用户，不假装已全部申请。

## 待人工验证（制作人/测试）

- 点击「补充扩展权限」应先弹确认框并列出能力与原始 scope；取消不发起授权。
- 真实飞书账号完成增量授权后，卡片状态与权限摘要应自动刷新，不再常驻「补充扩展权限」。
- 对话中命中权限缺口时，选项应为可执行 CTA（跳转授权 → 自动续跑），而非把文案当新消息发出。
