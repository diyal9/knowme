## Context

See `proposal.md` for motivation and the delta specs for observable behavior. 当前 `workspace.html` 将 `#agentChatLog` 与 `.agent-col-foot` 固定为两个纵向兄弟节点；`renderChat()` 在无消息时只替换 Chat Log 内容，因此 Composer 永远停在底部。消息、模型、附件和快捷菜单的事件均绑定在唯一 Composer 节点上，不适合复制第二套首屏输入控件。

本变更仅涉及 Electron Renderer 的 DOM 编排和样式。主进程、preload、IPC、Agent Run 与 Session 持久化边界保持不变。

## Goals / Non-Goals

**Goals:**

- 用同一个 Composer 节点支持任务启动态和会话态，避免双状态同步。
- 让 `renderChat()` 依据 `chatHistory/runArtifacts` 唯一决定布局状态。
- 保留任务卡、快捷命令、附件、模型选择、流式渲染和 preflight 的原执行语义。
- 只做常数级 DOM 移动，不增加启动 IPC、依赖或常驻数据。

**Non-Goals:**

- 不调整 Agent 运行时、Session 数据结构或模型请求。
- 不新增外部字体、图片、动画库。
- 不改变工作台模式和专家能力的业务内容。

## Decisions

### 1. 移动唯一 Composer，而不是复制输入框

空状态 HTML 增加一个 Composer mount。`renderChat()` 每次重绘前先把现有 `.agent-col-foot` 安全停回 `#agentChatLog` 之后，避免 `innerHTML` 清空时销毁节点；空状态内容写入后，再把该节点移动到 mount。会话态保持原 DOM 层级。

选择 DOM 移动是因为节点事件、输入草稿、附件状态、菜单焦点和模型状态会随节点保留。替代方案是渲染第二套首屏 Composer，但会引入双向状态同步、重复 ID 与焦点冲突，因此不采用。

### 2. 由现有空状态判定驱动单一 CSS 状态类

`chatHistory.length === 0 && runArtifacts.length === 0` 时给 Agent 列增加任务启动态类；否则移除。样式只依赖该类和 mount，不新增持久化状态，Session 切换和恢复会自然复用 `renderChat()`。

替代方案是在发送事件里手动切类，但快捷任务、历史恢复、产物恢复和错误分支都可能绕过单一发送入口，容易状态漂移。

### 3. 保留动态空状态内容，统一外层视觉结构

通用、能力包、专家、知识管家、写作和编程模式继续使用现有任务来源与 `data-*` 执行属性；只统一增加首屏标记、标题区、Composer mount 和“开始使用”层级。能力包的独立工作流入口继续保留在任务区之后。

这避免把参考图中的微信/Slack 示例误做成无实现能力，同时保持四卡推荐与 Skill 动态目录。

### 4. 会话消息采用非对称角色排版

用户气泡改为右对齐、自适应宽度和轻背景；助手消息仍占稳定阅读轨道，降低装饰性边框但不改变内部 Markdown、执行轨迹或结构化 UI。错误、等待和专业结果类继续沿用助手轨道。

### 5. 响应式与动效保持克制

首屏宽度由现有消息轨道控制，桌面使用 2×2 卡片，窄窗口转单列；引导区只保留一行简短说明，不使用大标题或额外装饰性助手图标。附件和发送按钮完全复用会话态样式，避免同一 Composer 在移动前后产生控件跳变。只使用短时淡入/位移动画，并遵守 `prefers-reduced-motion`；任务卡继续复用现有 SVG 图标，避免额外网络和内存开销。

### 6. 顶栏“+”只负责新建内置助手会话

“+”菜单直接使用 Session API 返回的四个内置模式，不再与 Capability Hub 专家目录合并。专家仍可通过能力入口启动，已有专家 Session 的展示和恢复不受影响。这样“新建助手模式”和“启动专家能力”的入口职责保持清晰。

## Risks / Trade-offs

- [在 Chat Log 更新 `innerHTML` 时 Composer 仍位于其中会被销毁] → 每次更新前强制停回稳定 dock，再写入空状态 DOM。
- [移动 Composer 后绝对定位菜单的参照上下文变化] → mount 保持相对定位和完整宽度，快捷菜单继续以 Composer/foot 宽度为基准。
- [已有静态测试假设所有气泡同宽] → 更新为助手轨道稳定、用户气泡自适应的行为断言。
- [工作台空状态信息密度较高] → 工作台专用 `agent-empty-workbench` 保持原布局，不强行套用任务启动 Hero。
- [窗口较矮时首屏被压缩] → Chat Log 继续可滚动，首屏使用最小间距与响应式单列，不隐藏关键控件。
- [移出“+”菜单后专家无法启动] → 保留 Capability Hub 的专家启动链路与已有专家 Session 恢复逻辑。

## Migration Plan

1. 增加首屏结构、Composer mount 与状态样式。
2. 在 `renderChat()` 中实现可逆的 Composer 停靠，并更新空状态渲染。
3. 调整用户/助手消息对齐和静态测试。
4. 运行单测、lint 与 Electron/UI 冒烟并记录证据。

回滚仅需恢复 Renderer HTML/JS 与测试；没有数据迁移或主进程兼容问题。
