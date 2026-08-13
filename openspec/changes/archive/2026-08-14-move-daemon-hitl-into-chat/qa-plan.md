# QA Plan: move-daemon-hitl-into-chat

## Smoke Scope

- Daemon 任务进入 need_input / 澄清：左栏出现提问卡；无「回答」按钮；无弹窗
- 输入框回复并发送：澄清提交，任务继续
- Gate 等待：对话卡可点通过/修订/打回
- 右栏审阅与过程日志 Tab 仍可用

## 反模式

- 双入口：对话与底栏同时可回答
- 发送澄清却误触发 LLM 闲聊
- 轮询导致重复 HITL 卡刷屏
