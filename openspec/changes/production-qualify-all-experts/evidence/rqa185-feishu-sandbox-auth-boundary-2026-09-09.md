# RQA185：Feishu 沙箱认证边界

日期：2026-09-09

## 只读核验

在当前执行环境运行 Feishu CLI 的认证状态检查（不执行登录、不读取 token 内容）：

- `identity=none`
- bot：`not_configured`
- user：`missing`
- CLI 提示当前 keychain 中没有用户 token

## 与 KnowMe 历史记录的关系

KnowMe 用户数据中的历史 `agent-runs` 仍保留：

- Feishu：2 次成功完成运行，工具面包含 Feishu 读取/候选能力。
- Pango：1 次成功完成运行，工具面包含 Pango MCP loader。

这证明历史运行曾在可用上下文中看到对应工具，但不等于当前沙箱能解密或复用用户身份。审计因此同时保留 `historicalRunEvidence` 与当前 `auth_required`/`offline` 探针，不将前者提升为当前授权。

## 安全边界

- 未发起新的 Feishu 登录流程，避免在用户未请求时产生新的外部授权状态。
- 未读取、复制或输出 access token、keychain 内容或任何密钥。
- 当前六专家真实资格仍需在正常 KnowMe Electron 用户会话中完成复核。

