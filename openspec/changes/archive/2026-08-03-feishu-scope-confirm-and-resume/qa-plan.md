# QA Plan: feishu-scope-confirm-and-resume

## Smoke Scope

- [x] 设置 → 连接器 → 飞书卡片：点击「补充扩展权限」，确认面板弹出并列出将申请的能力
- [x] 确认面板点「取消」：不打开浏览器，卡片状态不变
- [x] 确认面板点「确认授权」后，在飞书中**不**确认时不得出现「飞书授权成功」（baseline 逻辑 + 单测）
- [x] 非法/未知 runtime scope 不会导致「不允许的协议」或整轮发起失败（降级阶梯端到端）
- [x] 对话中权限缺口：确定性 `knowme://feishu/auth` CTA，点击走应用内授权而非外链
- [ ] 真人扫码完成授权后卡片刷新与对话自动续跑（ADVISORY，建议用户本地确认）

## 反模式检查（Tester）

- [x] 未授权时点两次确认按钮，不得重复拉起两个 device flow（in_progress 复用）
- [x] 授权超时后文案点名未获批能力 / 降级为「重试补充权限」
- [x] 部分分区权限受限时正文不得编造未取到的文件

## 自动化

- `npm test`：feishu-auth / feishu-cli / feishu-scope-confirm / grounding / workspace-agent
- `npm run lint`
