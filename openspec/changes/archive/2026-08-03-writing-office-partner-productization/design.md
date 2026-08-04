# Design: writing-office-partner-productization

## 架构

写作办公搭档沿用现有 Agent 工作流，不新建平行模块：

1. `src/workspace-agent.js`
   - 写作空态卡片
   - `Ctrl/Cmd+K` 快捷动作
   - 发送前后的 prompt 组装
   - 长文产物卡与右侧审阅入口
2. `src/lib/conversation-grounding.js`
   - 识别需求文档、办公文档、提纲成稿、排版定稿等任务类型
   - 为模型生成更稳定的目标/材料/结果接地信息
3. `src/lib/assistant-prompt-router.js`
   - 强化写作 scene 的基础规则
   - 固定“结构化成稿 → 去 AI 味 → 交付/审阅”的顺序
4. `src/lib/agent-run.js`
   - 继续使用 `text` / `editor_patch` 产物
   - 为长文审阅补充更明确的 `meta` 信息
5. `src/lib/connectors/feishu-cli.js`
   - 复用 `feishu.draft_write_doc`
   - 保持 pending_review -> approve/reject 的两阶段写入

## 进程边界

| 层 | 位置 | 责任 |
|----|------|------|
| Renderer | `src/workspace-agent.js` | 快捷入口、聊天 UI、产物卡、用户动作 |
| Shared browser logic | `src/lib/conversation-grounding.js` | 任务识别、写作接地、轻量规则 |
| Main / Node | `src/main.js` + `src/lib/agent-tools.js` | scene prompt、工具暴露、Feishu 草稿审批 |
| Connector runtime | `src/lib/connectors/feishu-cli.js` | 文档草稿创建、dry-run、确认应用 |

## 交互流程

### 1. 日常文档入口

- 空态卡片改为：写需求文档 / 写办公文档 / 按提纲成稿 / 排版定稿
- 快捷菜单提供同类任务，并额外保留“润色去 AI 味”
- 点卡片或快捷动作后，系统直接发送结构化写作意图，不让用户理解为“提示词模板”

### 2. 写作执行管线

1. 识别任务类型
2. 判断是否已有正文/提纲/材料
3. 材料充分时直接生成结构化初稿
4. 对输出做“去 AI 味”后处理
5. 短文留在聊天；长文生成 draft artifact
6. 用户选择：
   - 写入当前编辑器
   - 生成飞书文档草稿
   - 继续在聊天中追问或改写

### 3. 去 AI 味策略

不把 Humanizer-zh 当作运行时依赖，而是将其核心规则内置为本地规则包：

- 识别并弱化空泛拔高、宣传腔、三段排比、过度“此外/至关重要/赋能/深度”等表达
- 优先保留事实、术语和结论顺序，不强行口语化
- 按任务类型分级：
  - 需求文档：重结构、边界、验收，不做过度修辞
  - 办公文档：重可发送、自然、简洁
  - 提纲成稿：重连贯和段落过渡
  - 排版定稿：重标题层级、列表、行动项可读性

## 产物与飞书草稿

- 普通短文：仍走聊天气泡 + “应用到文件”
- 长文稿：创建 `text` artifact，并通过右侧审阅区查看全文
- 用户确认“生成飞书文档草稿”后，调用 `feishu.draft_write_doc`
- Feishu 写入必须保持本地 pending_review 状态，不直接远端创建

## 风险与权衡

- 默认去 AI 味过强会伤害需求文档的专业性，因此必须按任务类型调节强度
- 长文是否进 artifact 需要有稳定阈值，否则会让短文也进入右侧审阅，增加打断感
- 飞书草稿链路已经存在，重点是把写作场景稳定接进去，而不是重做 connector
