# Design: refine-my-agent-start-handoff

## 1. 交接链路的三个断点

```
工作台「我的智能体」卡片            助理对话
┌───────────────────┐            ┌──────────────────────┐
│ ui-expert          │            │ (通用) 把你的问题交给  │
│ UI 专家：聚焦…      │ ─ start ─▶ │ KnowMe，它来帮你完成   │  ← 断点 A：身份丢失
│ [开始使用] [调优]   │            │ 开始使用   ui-expert  │
└───────────────────┘            └──────────────────────┘
        │                                  ▲
        │ 断点 B：渲染层目录查不到就否决      │ 主进程 createSessionSnapshot
        │        （比内核更严）              │ 本就允许 degraded
        └── 断点 C：异步期间无 pending，可连点 ─┘
```

### 断点 B 的证据

- 卡片数据源：`main.js listLocalWorkbenchAgents()` → `expertRuntime().listExperts()`
- 启动校验源：`workspace-agent.js ensureExpertCatalog()` → `expert.list` IPC，**异常时静默置空**
- 内核态度：`expert-runtime.js createSessionSnapshot()` 仅在 `loadExpert` 失败时返回错误，readiness 为 `limited` 时照样落快照并返回 `degraded: true`

结论：渲染层那句 `if (!expert) return { ok:false, error:'专家不存在或尚未安装' }` 是**比内核更严的多余门**，删掉后由 `agent-session-new` → `loadExpert` 承担权威校验，语义更准（错误来自真实加载失败，而非缓存缺失）。

## 2. 决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 谁校验 expertId | 主进程 `loadExpert` | 单一事实源；渲染层缓存只做展示，不做准入 |
| 目录缓存仍然刷新吗 | 是，仅用于取显示名 | 名称拿不到就退回 id，不影响能否开聊 |
| 身份区放在哪 | 专家空态首屏顶部（组合器之上） | 首屏第一眼即可确认对象；不侵入已有对话流 |
| 通用文案怎么处理 | `renderLaunchIntroHtml(meta, intro)` 增加可选 intro，默认不变 | 该函数被 4 处空态复用，默认行为必须零回归 |
| 头像 | 走既有 `StickyIcons` 图标语义（`roleIconName`） | 专家数据里的 `avatar` 是 emoji（`'🧩'`），直出会破坏视觉体系 |
| pending 状态存哪 | 模块级 `Set` 记 agentId | 避免重复渲染丢状态；同时天然防连点 |

## 3. 视觉与交互口径（design-taste-frontend-v1 落地）

技能面向 React / Tailwind / Framer Motion，本项目是 Electron + 原生 HTML/CSS，因此**架构类条款不适用**，保留并执行其「品味」与「交互完整性」条款：

| 技能条款 | 本次落地 |
|---|---|
| ANTI-EMOJI POLICY | 身份区与卡片一律不直出 emoji 头像，改用图标标记 |
| Max 1 Accent / THE LILA BAN | 只用既有 `--wb-accent`（墨绿），无紫色、无霓虹外发光 |
| Rule 5 Interactive UI States | 补 pending（正在打开…）、失败可恢复、按压 `translateY(1px)`、`focus-visible` 焦点环 |
| Materiality（阴影贴合背景色调） | 卡片 hover 阴影沿用 `rgba(36,37,34,.07)` 暖中性，不加冷色投影 |
| 仅动画 transform / opacity | pending 用 opacity 脉冲，不动 `width/height` |
| prefers-reduced-motion | 位移与脉冲在 reduce 下关闭 |
| NO 3-Column Card Layouts | 沿用既有 `auto-fill minmax(272px,1fr)` 自适应网格，不硬编码三列 |
| 不适用条款 | RSC/`use client`、Tailwind 版本锁、Framer `layoutId`、`min-h-[100dvh]`、字体族替换（桌面端沿用 `--ui`） |

## 4. 降级文案口径

readiness 有 `limited` 项时，欢迎面在能力芯片下方补一句明确许可：

> 有依赖未就绪，仍可直接对话；需要用到它时再去配置。

避免用户看到黄色 `limited` 芯片就以为不能用——这是「解释降级」而不是「警告失败」。

## 5. 失败路径

| 场景 | 行为 |
|---|---|
| `startExpertChat` 不可用（助理模块未就绪） | 按钮恢复，toast「助理对话暂不可用」，留在工作台 |
| 主进程 `loadExpert` 失败（Agent 文件损坏/已删） | 按钮恢复，toast 携带主进程错因 + 提示去「调优」查看，只弹一条 |
| 助手正在生成 | 按钮恢复，toast「当前助手正在生成，请稍候」 |
