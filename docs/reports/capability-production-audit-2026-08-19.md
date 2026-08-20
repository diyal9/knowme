# 能力中心生产验收报告（2026-08-19）

## 结论

- 实际目录：21 位官方专家、16 个 Skill。
- 安装与运行时：21/21 专家、16/16 Skill 安装或能力包挂载成功；所有专家均可解析并创建非降级快照。
- 工作台：21 位专家均已加入当前 `visual` 工作台；“我的专家”拥有完整安装记录。
- 真实执行：21/21 专家任务完成并生成交付物，且逐项验收接口成功；16/16 Skill 均通过真实 AI 生成链。
- 内容质量：12 位专家达到本轮最小验收，2 位需要收紧默认假设，7 位存在明显事实臆造或任务理解偏差。后 9 位不应按当前提示词直接作为生产级正式专家发布。
- Skill：12 个本地/通用 Skill 通过；4 个飞书 Skill 的运行时、技能上下文和 AI 生成通过，飞书连接器在线且权限完整，但本轮未读取用户私人飞书内容，因此外部数据读取仍标记为“有条件通过”。
- 发布门禁：Renderer production build、lint、typecheck、OpenSpec health 通过；全仓测试仍有 2 个稳定失败，当前不能标记为全绿发布。

## 专家逐项结果

### 通过（12）

| 专家 | 验收任务 | 结果 |
|---|---|---|
| 办公协作专家 | 工作同步 | 事实边界清楚，输出可直接发送 |
| 汇报撰写专家 | 三页汇报提纲 | 满足结构与决策导向 |
| 会议纪要专家 | 结论、行动项、风险 | 严格基于输入，未补造责任信息 |
| 软件开发工程师 | TypeScript 防抖与测试点 | 实现和测试覆盖有效 |
| 商业洞察专家 | 激活与留存变化洞察 | 推断以可能性表达，并给出验证路径 |
| 生图执行专家 | 可执行生图提示词 | 覆盖主体、氛围与限制 |
| 事实核查专家 | 绝对化陈述核查 | 明确当前不能下结论并给出证据步骤 |
| 数据分析师 | 两组转化率判断 | 结论克制，正确提示样本与显著性限制 |
| 行动项管理员 | 行动项整理 | 负责人、时点与缺口清楚 |
| 需求评审专家 | 导出按钮评审 | 补充项和风险有效 |
| 用户研究员 | 五个访谈问题 | 问题中立，主动声明样本局限 |
| 长文编辑 | 四段式文章结构 | 结构完整、编辑原则明确 |

### 需要收紧默认假设（2）

| 专家 | 问题 | 建议 |
|---|---|---|
| 产品经理 | 自行限定“仅当前会话、最近一次失败、不持久化”，没有标为方案假设 | 未给定的范围只能列为待确认或备选方案，不能写入正式范围 |
| 质量测试专家 | 使用“账号、已激活成员、数据库事务”等非 KnowMe 产品术语，并假定权限模型 | 增加 KnowMe 产品词汇和真实状态模型；未知实现只写验证点，不写既定预期 |

### 当前不建议发布（7）

| 专家 | 主要失败证据 | 建议处理方向 |
|---|---|---|
| 创意策划 | 捏造“品牌规范 v2.3、2024Q2、官方资产库、官方色值和版权声明” | 禁止生成未提供的品牌事实；把色值与规范明确标为提案 |
| 内容策划专家 | 捏造 Q3 试点、内部入口、12 类模块、调用指标和业务场景 | 所有组织事实必须来自材料；无材料时只给栏目框架 |
| 解决方案架构师 | 捏造 50MB、72 小时、30 秒、重试 3 次等约束 | 参数必须进入“建议默认值/待确认”，不得当成系统边界 |
| 视觉设计师 | 捏造 KnowMe 品牌蓝；方案与“简洁”目标冲突，且 32% 头像、动态气泡、48px 强制间距不适配现有主题 | 注入真实设计 Token，并增加现有界面/主题一致性约束 |
| 数据报告专家 | 将“新增 120”写成“较上期增长”，输入并未提供新增环比 | 数字陈述必须逐项绑定输入，不允许补趋势 |
| 研究分析师 | 捏造 N=12、历史周期、Gateway v2.3、样本量、Cohen’s κ、数据库和权限编号 | 无证据时只给研究设计和建议样本，不得伪装成已存在数据 |
| 知识策展专家 | 将 Agent 安装误解为设备现场安装，捏造工程师、国标、SOW、NAS 和签字页 | 注入 KnowMe 领域模型；优先识别软件 Agent/任务/交付物语义 |

## Skill 逐项结果

### 直接通过（12）

- `code-review`
- `visual-brief-prompt`
- `knowledge-steward`
- `writing-polish`
- `game-qa-acceptance`
- `game-requirement-doc`
- `game-dev-delivery`
- `game-production`
- `office-document`
- `office-document-finalize`
- `office-outline-draft`
- `office-requirement-doc`

每个 Skill 均通过：目录发现、启用状态、L1 正文加载、Grounding Contract 校验、Renderer IPC 加载、显式 Skill 引用后的真实 AI 生成。

### 有条件通过（4）

- `feishu-doc-kb`
- `feishu-meeting-summary`
- `feishu-related-chats`
- `feishu-today-priority`

飞书连接器状态为 `online`，用户身份、Bot、权限分类和对应能力均显示 ready；四个 Skill 的真实 AI 生成通过。为避免在未指定对象时读取私人内容，本轮只验证了技能契约和只读边界，没有执行具体文档、聊天、会议或日程读取。

## 工作台与智能伙伴限制

- 21 位专家均已绑定到当前活动工作台模式 `visual`。
- `personal-expert-roster` 当前最多向智能伙伴投影 12 位常用专家。也就是说，工作台持久化中有 21 位，但智能伙伴只能读取前 12 位。这是产品容量限制，不是安装失败；如要求智能伙伴识别全部专家，需要单独调整上限或改为检索式专家目录。

## 发布门禁

通过：

- `npm run lint`
- `npm run typecheck:renderer`
- `npm run renderer:build`
- `npm run openspec:health`
- 能力包第三方示例测试单独复跑通过（全量首轮出现一次偶发失败）

稳定失败：

1. `tests/studio-component-closed-loop.test.js`：Studio 调色板缺少 `human` 节点。
2. `src/renderer/app/surface-css-contract.spec.ts`：`agent-chrome.css` 仍存在 11px 字号，违反统一最小 12px 的排版契约。

因此 `npm run check` 当前未全绿。上述两项与本轮专家/Skill 安装数据无直接关系，但属于发布门禁问题。

## 数据与证据

- 安装前备份：`%APPDATA%\KnowMe\audit\capability-production-2026-08-19T07-29-54-679Z`
- 专家真实任务结果：`%APPDATA%\KnowMe\audit\capability-live-2026-08-19T07-39-09-146Z.json`
- Skill 真实生成结果：`%APPDATA%\KnowMe\audit\skill-live-2026-08-19T07-49-34-877Z.json`
- 可复跑脚本：
  - `scripts/audit-production-capabilities.js`
  - `scripts/audit-capability-live.js`
  - `scripts/audit-skill-live.js`

本轮未删除任何专家、Skill 或用户数据。
