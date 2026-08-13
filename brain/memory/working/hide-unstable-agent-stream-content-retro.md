# Retro：隐藏不稳定 Agent 流式原文

## 问题根因

legacy/兼容流式路径把 `splitStreamingMarkdown()` 的 tail 通过 `escHtml(tail)` 直接写入可见 DOM；随后 tail 稳定后被 Markdown 节点替换，形成“原始源码闪现 → 格式刷新”。此外 `paintStreamText()` 曾绕过协议清洗，thinking/suggestion 片段存在旁路风险。

## 有效做法

- 展示边界只返回 `stable + pending`，不返回 tail 文本，降低误用概率。
- pending 使用固定产品文案，模型尾部只留在消息内存。
- legacy 流与 V2 canonical answer 共用展示协议清洗。
- 用 sentinel 保留协议清洗前后的流式换行边界。
- 取消时只保留 stable 内容，避免终态暴露半截链接或 Markdown。
- Electron fixture 同时验证 visible text、raw HTML、节点身份、真实 IPC 与滚动漂移。

## 可复用约束

1. 未验证或未闭合模型内容不得进入 DOM，即使 CSS 隐藏也不允许。
2. 流式反馈应由产品状态承接，不能用原始协议文本充当进度。
3. 完成、取消、失败都必须分别验证展示收敛，不可只测成功路径。
4. 任何协议清洗函数若会 `trim()`，流式调用必须显式保留结构边界。

## 后续建议

- 将 legacy 上滑期间的逐 chunk 漂移纳入独立视觉基线。
- 增加超长无换行回答的等待时长与可达性指标。
- 后续替换 Markdown parser 时保留 stable/pending 信任边界。
