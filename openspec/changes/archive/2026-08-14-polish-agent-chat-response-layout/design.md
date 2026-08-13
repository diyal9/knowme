## Context

See `proposal.md` for motivation and `specs/agent-chat-ux/spec.md` for observable requirements. 当前 Agent 会话使用 `--agent-message-track` 同时约束助手气泡、执行过程和 Composer，普通 `.agent-md` 正文与结构化选择因此在宽窗口中接近 920px。会话态与空会话任务启动态复用同一个 Composer 节点，但已有 `agent-launch-state` 和 mount 选择器可以提供不同尺寸。

本变更只触及 Electron Renderer 的 HTML/CSS 与静态测试。主进程、preload、IPC、Agent 输出协议和 Session 持久化边界保持不变；不增加启动请求、运行时监听或持久数据。

## Goals / Non-Goals

**Goals:**

- 在保留消息轨道用于表格、执行过程等宽内容的同时，为普通正文建立更窄的阅读轨道。
- 让结构化选择具备明确的操作区层级和完整交互状态。
- 通过既有空态状态类区分大尺寸启动 Composer 与紧凑会话 Composer。
- 主要使用 CSS 完成布局升级，仅在 Composer 从启动态停靠回会话态时复用现有高度测量，不增加监听器、DOM 包装或常驻内存。

**Non-Goals:**

- 不改变 Markdown 解析、流式节点协调或结构化选择事件处理。
- 不在 Renderer 中检测、删除模型正文与选择项的语义重复。
- 不改变专业结果卡、执行时间线和空会话首页的信息架构。

## Decisions

### 1. 保留外层消息轨道，新增内层阅读轨道

外层 `--agent-message-track` 继续承载需要宽度的执行过程、表格和专业结果；普通 `.agent-response-body`、`.agent-structured-ui` 及回复动作使用新的阅读轨道变量并左对齐。这样长文本不会铺满窗口，同时不压缩现有复杂内容。

替代方案是直接把全局消息轨道从 920px 改小，但会同时挤压表格、工具证据和专业结果，因此不采用。

### 2. 结构化选择使用轻表面而非重卡片堆叠

选择区通过克制的顶部留白、标题状态行和浅色容器形成分区；单项使用较高对比度文字、细边界和短时 hover/focus/pressed 反馈。说明文字允许两行或自然换行，避免当前单行省略造成信息缺失。

替代方案是为每项增加强阴影和大圆角，但会与正文产生过多卡片感，也会放大重复内容的视觉噪声。

### 3. 只收紧会话态 Composer

默认 Composer 降低最小高度和 textarea 起始高度；`agent-launch-state` 下已有更具体的 mount 规则继续覆盖为大输入空间。由于 textarea 自动增长会把启动态高度写入 inline style，停靠回会话态后调用既有 `resizeAiInput()` 重新测量一次。输入自动增长上限、附件、快捷菜单和模型控件不变。

替代方案是修改 DOM 或维护两套 Composer 尺寸状态，但现有 CSS 状态已经足够，额外 JS 会增加状态漂移风险。

### 4. 响应式退化为全宽并保留可读交互

阅读轨道使用 `min(..., 100%)`，窄窗口自动占满可用消息宽度；选择项网格保留编号和正文两列，说明文字改为换行，不隐藏核心信息。动画仅使用 `transform`、颜色和阴影，并遵守现有 reduced-motion 约束。

## Risks / Trade-offs

- [正文变窄后部分中文回答纵向变长] → 采用约 760–800px 的温和约束，并保持表格等宽内容可使用外层轨道。
- [结构化说明换行增加选择区高度] → 优先保证信息完整；通过收紧单项 padding 和列表间距控制整体高度。
- [CSS 选择器影响专业结果布局] → 对 `.related-chats-result` 等已有专业结果维持其专用宽度规则，新增规则只覆盖普通回复区域。
- [Composer 高度降低导致长输入拥挤] → 仅降低初始最小高度，保留 textarea 自动增长和现有最大高度。

## Migration Plan

1. 调整 Renderer 中正文阅读轨道、Markdown 节奏、结构化选择和会话态 Composer 样式。
2. 补充静态契约测试，验证阅读轨道、说明换行和空态尺寸覆盖仍存在。
3. 运行 OpenSpec 校验、单测、lint 与 Electron/UI 冒烟。

回滚只需恢复 `workspace.html` 样式和对应测试；没有数据迁移、IPC 兼容或缓存清理。
