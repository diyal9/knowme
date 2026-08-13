## Context

See proposal.md — Why。当前 Daemon task-room 通栏 `#agentDialogueStatusBar` 同时投影 `mode` + `title`（目的）+ `meta`（工作流名），目的标题升级前后还会短暂并排像双标题。左栏 `agent-daemon-progress-card` 用 kicker「管线进度」+ 卡身，扫读像两层卡。右栏 `wb-run-topbar` 在 task-room 已隐藏，副身份无处安放。

渲染层改动为主；不新增 IPC。

## Goals / Non-Goals

**Goals:**
- Daemon 通栏：只留目的标题 + 态 + 返回
- 工作流短名落到右栏审阅 Tab 上方轻量身份行
- 左栏进度卡单层结构与间距

**Non-Goals:**
- 不恢复完整右栏 topbar / 双返回
- 不改 Daemon HTTP / SSE

## Decisions

1. **顶栏收敛**：`dialogueStatusProjection` 在 `daemonLive` 时 `meta=''`，并隐藏 `mode` 标签（避免「管线服务」+ 长标题抢位）。结论 pill 与返回保留。
2. **右栏副身份**：在 `#wbDaemonReview` Tab 上方增加 `#wbDaemonReviewIdentity`（或等价），文案为工作流短名；无工作流则隐藏。
3. **进度卡**：去掉独立 kicker 条；`aria-label` 仍为「管线进度」。结构为 head（当前步+状态）→ meta 比例 → bar → actions。终态可弱化 tip 以减噪。

## Risks / Trade-offs

- [模式标签隐藏] → 用户少一眼「管线服务」分类；目的标题前缀 `Daemon 阶段 ·` 已足够身份。
- [右栏身份行增高] → 控制为单行 28–32px，不引入第二套 topbar。
