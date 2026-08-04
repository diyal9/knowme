# Retro: 飞书办公搭档批量 Story Done（2026-07-29）

## 归档清单

- `related-chats-open-and-summarize`（含 AppLink→`feishu://` 直达）
- `related-chats-im-grounding-fix`
- `feishu-auth-inline-recovery`
- `meeting-summary-read-and-analyze`
- `feishu-minute-permission-request`
- `office-priority-feishu-grounding`
- `feishu-rich-resource-cards`
- `feishu-doc-kb-suggest`
- `steward-empty-align-home`

## 学到什么

1. AppLink https 落地页会强制「浏览器中转」；有客户端协议时应用 `feishu://` / `lark://`，并探测协议注册后再唤起。
2. Grounding 不能只看「本轮有没有工具结果」：二次分析要认 `priorFeishuFacts`，真未授权才给内联授权按钮。
3. 妙记 ACL ≠ 应用 scope；读失败应走草稿申请查看权限，不能引用户去改授权。

## 遗留 ADVISORY

- 多数 change 缺 `code-review.md`（软项）
- 真机扫码授权 / 妙记写申请 / 点链唤起飞书：测试报告标 ADVISORY，建议后续抽测
- `agent-composer-model-menu-fix`、`agent-suggestion-open-link` 仍活跃，未纳入本批
