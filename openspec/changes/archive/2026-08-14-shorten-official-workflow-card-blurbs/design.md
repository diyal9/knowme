## Context

货架卡第二行来自 `shelfCardBlurb(item)`，官方包优先展示 `item.description`。当前三条官方包把协作步骤写进 description，与 chips / 简要流程重复。See proposal.md — Why。

渲染层（`workbench.js`）与 CSS clamp 不变；本 change 只改 catalog 文案真源 `src/lib/official-workflows.js`。

## Goals / Non-Goals

**Goals:**

- 三条官方 `description` 改为一句 ≤ ~28 字的价值主张
- 用测试锁住「无逐步箭头链路」约定

**Non-Goals:**

- 不改 `shelfCardBlurb` / fork / 个人包落盘
- 不改 IPC、主进程供给管道

## Decisions

1. **改 catalog 文案，不改渲染逻辑**  
   原因：问题在数据，不是展示函数。改函数会影响个人包语义。  
   备选：在 `shelfCardBlurb` 截断/剥箭头 — 会误伤合法长说明。

2. **三条官方一并缩短**  
   原因：同类问题，避免只修 Brief 后其它卡仍吵。

3. **拟定文案**  
   - 会议闭环：`把会议资料整理成可跟进的纪要与待办。`  
   - 三角色协作交付：`按制作人、开发、测试三角色完成可验证交付。`  
   - Brief 出图审阅：`把视觉 Brief 变成可审阅的文案与出图提示词。`

## Risks / Trade-offs

- [已 fork 的个人副本仍保留旧长 description] → 接受；本 change 不迁移个人包；用户可编辑或重新复制。
- [搜索 haystack 变短] → 步骤词仍在 graph / 名称 / I/O 中，影响可忽略。

## Migration Plan

无数据迁移。重启应用后货架官方卡即用新文案。
