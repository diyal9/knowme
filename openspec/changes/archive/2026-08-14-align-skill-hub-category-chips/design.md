## Context

技能 Hub 分类 chip 写死在 `capability-hub.js` 的 `TAB_CATEGORIES.skills`。卡片主分类来自 catalog `categories[0]`，能力包 skill 经 `mapPackSkillToHub` 曾一律标为「能力包」。连接器 Tab 已有「飞书」维度，技能页不应再复制平台标签。

## Goals / Non-Goals

**Goals:**

- 技能筛选按工作域：写作 / 游戏 / 研发 / 办公
- 卡片主分类与 chip 对齐，避免点选空列表
- 飞书协作 skill 归「办公」，飞书连接器仍在连接器 Tab

**Non-Goals:**

- 动态从目录生成 chip（本轮仍静态列表）
- 改专家/连接器 chip 文案全集
- 能力包安装链路改造

## Decisions

1. **技能 chip**：`['全部', '写作', '游戏', '研发', '办公']`
2. **精选目录**：`code-review` 的 `开发` 改为 `研发`
3. **能力包 skill 主分类**：按 id/名称/所属包推断工作域；`pack` 保留在 tags/来源，不再作为主分类
4. **筛选匹配**：主分类相等，或 `categories` 数组含当前 chip（兼容多分类）
5. **IPC 边界**：分类推断在主进程 Hub service；渲染层只改 chip 与过滤比较

## Risks / Trade-offs

- 未知第三方能力包仍可能落到「能力包」主分类，仅在「全部」可见——可接受
- 「办公」与「写作」边界：飞书协作 → 办公；文档润色/office 文稿 → 写作
