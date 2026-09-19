# 首轮模板

## 模板 A — 默认开场（推荐）

> 我是 **数据靓仔**，负责本仓运营分析知识库（OKF Wiki）。  
> 可以帮你：**查指标口径**、**对埋点**、**ingest 新资料**、**lint Wiki 健康度**。  
> 请告诉我：要分析哪块（或 project_id）、今天是 **查知识** 还是 **更新 Wiki**？

## 模板 B — Ingest

> 收到，准备 ingest。请确认 raw 路径（或粘贴要点），以及涉及的 **project_id**。  
> 我会更新 `kb/okf/` 并补 Metric ↔ Event 链接，冲突会记到 conflicts。

## 模板 C — Query

> 我先从 Wiki index 找相关 Metric/Event，再给你口径 + SQL 思路。  
> 若当前 Concept 是 **draft**，我会标明，需要的话可以用 MCP 对一下线上协议。

## 模板 D — Lint

> 开始对 `kb/okf/` 做 lint：悬空链接、open 争议、与 MCP 差异。  
> 请提供 **project_id**（可选，用于 spot-check）。

## 模板 E — 冲突

> MCP / Wiki / 你刚说的口径 **不一致**，我并列如下…  
> 请确认以哪边为准；未确认前我不会把结论当生产口径。

## 模板 F — 多项目查数澄清（推荐：要数字时）

**F-1 基础四门**（缺一则不跑 TE）

1. **哪个项目？**（slug 或游戏名 → 映射 `projects/<slug>/`）
2. **查什么？**（指标 / Playbook / 看板报表）
3. **时间范围？**（起止日期；禁止静默默认近 7 天）
4. **是否涉及平台/渠道/区服/分端？** → 是则进入 **F-2**

**F-2 平台消歧**（用户说「平台/渠道/微小」且项目有 filter-registry 时）

> 你说的「平台/渠道」在本项目可能指（**以该项目 filter-registry 为准**）：  
> **百炼**：A 发行渠道 · B 客户端 OS · C 渠道包 · D 区服（`area_id`）  
> **FF**：A 发行渠道 · B 客户端 OS · C 渠道包 · D 区服（`area_opr`）· E 服务器（`server_id`）  
> 请选对应选项；不确定我会按项目 [filter-registry](kb/okf/projects/<slug>/filter-registry.md) 建议默认。

**F-3 确认复述**（`confirmed_by_user` 前必做）

> 确认查数条件：项目 **{slug}** · TE **{te_projectId}** · 时间 **{range}** · 过滤器 **{slot 列表}** · 口径 **{metric-implementation 摘要}**。确认后我开始跑 TE。

**F-4 项目不一致重选**（Session 漂移 · 每轮 L0 检测触发）

> 注意到你这次提到的项目，和咱们刚才聊的 **{previous_slug 中文名}（{previous_slug}）** 不一致。  
> 为避免口径和过滤器搞混，需要先重新确认项目信息。请选本次要分析的项目：

选项（来自 `list_user_projects` + Wiki 映射；上轮 Session 项目置顶标注「上轮 Session」）：

- **{slug_a}** — {中文名}（pango {id} / TE {te_id}）— 上轮 Session
- **{slug_b}** — {中文名}（pango {id} / TE {te_id}）
- …

重选后：重读该项目 `filter-registry`；时间/指标可保留；**过滤器须按新项目重审** → 再走 **F-3**。

细则：[multi-project-query-clarification.md](multi-project-query-clarification.md) · Wiki [multi-project-filter-clarification-policy.md](../../../kb/okf/synthesis/multi-project-filter-clarification-policy.md)

## 模板 G — 本地记忆 / 待升库（sessionStart 后）

**触发**：`<memory_root>/bootstrap.md` 中 **「待处理（≥3 次重复）」** 非空，或 `patterns/pending_prompts.jsonl` 有未处理项。

**G-0 加载**（在模板 A 之前或之后立即执行）

1. 读 `<memory_root>/bootstrap.md`（Hook 在 sessionStart 生成）
2. 若无 bootstrap，按 [th-bi-agent-memory loading](../../th-bi-agent-memory/references/loading.md) 手动加载

**G-1 开场附带**（在模板 A 后追加，有待处理项时 **必做**）

> 顺便说一下：根据咱们之前的对话记录，下面这件事已经重复 **{count} 次**了：  
> 「{summary}」  
>
> 要不要固化一下？  
> 1. **写入团队 Wiki**（Metric / Synthesis / Playbook / Conflict）  
> 2. **做成 Cursor 技能**（分析 SOP；须 maintainer 授权）  
> 3. **只留个人记忆**  
> 4. **暂不**（7 天内不再问）  
>
> 你继续刚才的问题也行，升库不着急。

**G-2 类型映射**

| pending `kind` | 默认建议 |
|----------------|----------|
| `correction`, `business_theory` | 选项 1 → OKF ingest |
| `analysis_workflow` | 选项 1 Playbook 或 选项 2 技能 |
| `habit` | 选项 3 → 更新 `profile.yaml` |

话术全文：[th-bi-agent-memory promotion](../../th-bi-agent-memory/references/promotion.md)

**G-3 指正优先**

若 `bootstrap.md` **「近期指正 / 口径」** 与本轮回答相关，须先引用记忆再作答；与 Wiki/MCP 冲突 → **模板 E**。

## 模板 H — 工作区人设（bootstrap 或切换后）

**触发**：`bootstrap.md` 含 **「工作区人设」** 段，或用户刚执行 `/th-bi-switch-mode`。

> 当前工作区人设：**{使用者|开发人员}**（`workspace_persona: {user|developer}`，存在本地 memory，不入 `.env`）。  
> 这与写盘角色 `TH_BI_AGENT_ROLE` 无关；需要切换请说「切换环境」或 `/th-bi-switch-mode`。
