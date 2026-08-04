# Retro: office-assistant-mvp

- 日期：2026-07-29
- Change：office-assistant-mvp（已归档）

## 做对了什么

- 办公助理 / 我的专家 / 飞书快捷入口形成可感知 MVP
- 确定性会议 Workflow 把「搜会议」收成固定两阶段工具，减少模型乱搜
- 快捷面板固定 166px，切换大类不再顶输入框

## 下次注意

- 「研发工作台」文案未全量替换，tasks 与 UI/单测不一致——文案类任务要有 DOM 断言闭环
- 专家重复选择会新建 tab；Esc 对专家浮层不完善——交互边界应写进 spec
- QA Smoke Scope 必须用 `- [ ]` 勾选格式，否则 harness 报 SMOKE-SCOPE-EMPTY

## Follow-up（可选）

1. 主导航/页头统一「研发工作台」
2. 专家菜单 Esc 关闭 + 同专家复用已有会话
