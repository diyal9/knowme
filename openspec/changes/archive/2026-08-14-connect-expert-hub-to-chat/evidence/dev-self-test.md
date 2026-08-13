# 开发自测：connect-expert-hub-to-chat

## 结论

通过。能力 Hub 已可安装、启用并启动持久专家会话；依赖缺失时进入 persona-only 降级模式，历史会话继续使用创建时快照。

## 自动化门禁

- `npm test`：通过，1196 tests / 206 suites / 0 failures。
- `npm run lint`：通过，`lint ok`、`script-scope ok`。
- `node openspec/changes/connect-expert-hub-to-chat/evidence/expert-loop-electron-smoke.js`：通过。
- 编辑文件 IDE diagnostics：0 errors。

## 三项修改规格证据

### capability-hub

- 专家详情根据状态显示“安装并开始 / 启用并开始 / 开始对话”。
- 安装或启用完成后才发送专家启动意图；进行中禁止重复点击，失败保留 Hub 并展示真实错误。
- 专家依赖缺失转为告警，不再阻断 persona-only 安装与启动。

覆盖：`tests/capability-hub.test.js`、`tests/capability-import.test.js`、Electron `available-cta`。

### agent-session-tabs

- 仅接受当前 Hub iframe 的启动消息，委托 `WorkspaceAgent.startExpertChat` 创建并激活独立 Session。
- 成功后关闭 Hub、展示专家身份和受限能力，并把焦点交给输入框。
- 会话持久化，重启后恢复专家欢迎区。

覆盖：`tests/workspace-capability-rail.test.js`、`tests/workspace-agent.test.js`，Electron `hub-closed`、`expert-identity-visible`、`composer-focused`、`restart-restores-expert-snapshot`。

### expert-runtime

- `agent-session-new` 是唯一专家 Session 创建入口，快照包含 persona、技能/连接器绑定及 readiness。
- 缺失依赖生成 `limited` readiness，不阻断普通对话；空 allowlist 保持显式 deny-all。
- 专家卸载后旧 Session 仍从快照恢复，不随实时定义漂移。

覆盖：`tests/expert-runtime.test.js`、`tests/expert-session-capability-filter.test.js`，Electron `degraded-bindings-visible`、`durable-expert-session`、`snapshot-survives-uninstall`。

## Electron 证据

- 结构化报告：`evidence/expert-loop-electron-smoke.json`
- 截图：`evidence/screenshots/expert-persona-only-session.png`
- Renderer console errors：0

验收期间发现 Hub iframe 在关闭后仍持有焦点，已增加会话交接后的延迟回焦并纳入自动化断言。
