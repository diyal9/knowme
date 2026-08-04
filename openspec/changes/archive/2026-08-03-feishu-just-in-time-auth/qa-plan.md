# QA Plan: feishu-just-in-time-auth

## Smoke Scope

- [x] 无权限读取个人飞书文档时，对话内出现失败卡片（友好能力名），非跳设置旧提示
- [x] 卡片可展开「查看所需权限」显示原始 scope
- [x] 点「补齐授权并继续」按增量 scope 拉起授权
- [x] 授权确认后自动续跑原始提问并读到正文

## Regression

- [x] `feishu.search_docs` 命中不误报授权/阻断
- [x] `feishu.doc_kb_suggest` 成功返回空 hint、不阻断
- [x] 已有 `read_doc` / `get_wiki_node` / `meeting_read` 链路不回退

## Anti-pattern Checks

- [x] 不把"工具未授权"和"本轮缺少正文证据"混成同一句提示
- [x] 妙记 ACL 拒绝不被误判为缺 scope
- [x] "文档不存在"不被转成授权 CTA
- [x] 401/403 无可解析 scope 时给通用重新授权，不落"会议/妙记"错配措辞
- [x] 无权限一律不编造正文
