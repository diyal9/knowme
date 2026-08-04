# 制作人体验验收: feishu-scope-confirm-and-resume

## 核心路径

| 路径 | 结论 | 证据 |
|---|---|---|
| 补充扩展权限前弹出确认框，列出能力 + 原始 scope | 通过 | `settings.html` 确认面板；预览图 `evidence/screenshots/scope-confirm.png` |
| 取消不发起授权 | 通过 | `confirmFeishuScopeRequest` 在取消时 return false |
| 增量授权不以「已就绪」假成功 | 通过 | `feishuAuthBaseline` + `scopeSignature`；单测覆盖 |
| 对话内 `knowme://feishu/auth` 不报「不允许的协议」 | 通过 | `handleFeishuLinkAction` 顶部拦截；回归测试 |
| 非法 runtime scope 不毒化整轮授权 | 通过 | `sanitizeExtraScopes` + 阶梯降级；`lark-cli` 端到端复现 |
| 全分区权限失败 → 确定性 CTA + 可续跑 | 通过 | `executeDocKbSuggest` → `missing_scope`；grounding 单测 |

## 体验标准

- 用户能看懂本轮要申请什么权限
- 不会假成功诱导无限重试
- 对话内点授权应直接拉起，而非协议错误

## 遗留（ADVISORY）

- 真实飞书账号完成扫码后的卡片刷新与对话自动续跑，建议用户本地再点一次确认（本机已用 `lark-cli` 验证发起与降级链路）

## 验收结论

- [x] 通过
- 验收人：制作人
- 日期：2026-08-03
