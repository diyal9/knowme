# QA Plan: align-daemon-process-feed-chat-order

## Smoke Scope（必填）

- [ ] 打开管线执行间：左栏「当前工作」在上、过程日志在下、输入框最底
- [ ] 轮询时能看到最新日志行（贴底）
- [ ] 发送一条补充消息后，过程块仍在消息下方

## Regression Scope

- 右栏步骤/制品/变更/事件
- 收起/展开 progress 与日志

## Anti-pattern Checks

- 是否又把过程块钉回顶部
- 是否用 column-reverse「假装」正序
