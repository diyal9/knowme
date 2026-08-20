## 1. Profile v3 与个人服务

- [x] 1.1 扩展 Agent Profile v3 Reader/Writer、情境与安全快照（personal-agent / agent-profile）
- [x] 1.2 实现 `my-knowme` 单例、受限教导、提案应用、成长日志与有界存储（personal-agent）
- [x] 1.3 注册 personalAgent IPC、preload 与共享 DTO，并覆盖单元测试（personal-agent）

## 2. Session 与 UI

- [x] 2.1 扩展 Session `sessionKind/profileId/contextId` 兼容读取与新会话写入（agent-session-tabs）
- [x] 2.2 将助理导航改为“我的 KnowMe”，移除四人格切换，保留 Skill 场景快捷项（agent-session-tabs）
- [x] 2.3 将“专家库”改为“Agent 中心”并更新 Tab 语义（capability-hub）
- [x] 2.4 增加懒加载培养面板与设置摘要入口（personal-agent）

## 3. 兼容与门禁

- [x] 3.1 覆盖 v2 Profile、旧模式 Session、单例、多主题、情境、教导确认和撤销测试
- [x] 3.2 完成 `npm run check`、Renderer build、OpenSpec validate/health、当前 change gate
- [x] 3.3 完成 Electron 核心路径冒烟、制作人验收与测试报告
