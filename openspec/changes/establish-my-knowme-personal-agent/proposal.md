## Why

现有“助理”同时承担人格切换、专家入口和普通对话，用户无法建立“这是我的长期工作代理”的稳定心智，也无法看清它积累了什么、在哪个工作情境中行动。先建立唯一、可培养的“我的 KnowMe”，才能让后续专家任务与工作流拥有清晰的关系边界和最小上下文交接基础。

## What Changes

- Agent Profile 升级为 v3，新增个人/叠加类型、身份、工作情境与任务偏好，复用现有知识、记忆和权限策略。
- 提供唯一 `my-knowme` / `personal` Profile，以及受限的读取、保存、教导、提案确认和成长记录接口。
- Session 增加个人主题与情境绑定；旧会话读旧写新，首次继续时绑定个人 Profile，不重写历史消息。
- 导航“助理”改为“我的 KnowMe”，“专家库”改为“Agent 中心”。
- 移除通用/知识管家/写作/编程的人格切换入口；能力快捷项继续作为 Skill 场景存在。
- 增加“培养我的 KnowMe”成长面板，呈现身份、能力、知识、记忆、权限和成长日志；设置页仅保留摘要与前往培养入口。

## 目标用户

持续使用 KnowMe 处理写作、开发、研究与知识工作的个人用户，希望自己的工作代理能在不同项目中保持同一身份，同时按工作区加载合适的能力、知识与边界。

## 验收标准

- 全局只有一个可命名、可设置二维头像的“我的 KnowMe”，所有新自由对话均是该人格下的主题。
- 多个主题之间消息隔离；工作区切换只改变情境，不切换人格。
- 明确且低风险的“记住”可以立即写入并撤销；推断、装备和权限变化必须先形成提案并确认。
- 旧 Profile、userProfile/userPrompt、Soul、四模式 Session 可读；继续旧会话不会改写历史消息。
- Agent Profile v3、个人代理 IPC、导航和成长界面具有自动化测试。

## 非目标（Non-goals）

- 本 change 不重构专家任务、工作流运行时或管线服务。
- 不让个人代理成为完全自主分身，也不允许其静默扩大权限。
- 不把完整个人记忆复制进组织 Agent、专家任务或工作流。

## Capabilities

### New Capabilities

- `personal-agent`: 唯一个人代理、情境、受限教导、成长提案与成长日志。

### Modified Capabilities

- `agent-profile`: Profile v3 与个人/叠加 Profile 兼容读取和快照。
- `agent-session-tabs`: 同一个人格下的多主题 Session 与旧模式恢复。
- `capability-hub`: “专家库”更名为“Agent 中心”，作为组织 Agent 与可装备能力的资源中心。

## Impact

- 主进程：`src/lib/agent-profile*.ts`、`src/lib/personal-agent*.ts`、Session normalization、IPC registrar。
- Preload/API：新增受限个人代理方法及 v3 DTO。
- Renderer：rail、Assistant Session chrome、成长面板、设置摘要、Agent 中心文案。
- 数据：继续使用 `agent-profiles.json`、Product Memory 和审计/成长事件；采用版本化 Reader 与新 Writer，不全量迁移。
