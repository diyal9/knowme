# QA Plan — extract-game-studio-capability-pack

## Smoke Scope

- [x] 能力包列表可发现 bundled `game-studio`，初始状态为未启用
- [x] 安装后四个游戏场景可见，禁用后不再出现在工作伙伴空状态
- [x] 旧 `industry=game` 设置首次启动可启用能力包，重复启动无重复条目
- [x] 旧 writing/coding/qa/planning Session 可映射至对应游戏场景
- [x] 第三方 `example-minimal` pack 可安装，无需核心代码分支
- [x] 路径穿越与无效 manifest 被拒绝

## Automated

- `node --test tests/capability-pack.test.js`
- `npm test`
- `npm run lint`
- `openspec validate extract-game-studio-capability-pack --strict`

## Manual / Electron

1. 启动 KnowMe，打开工作伙伴空状态。
2. 在能力包启用状态下确认游戏策划、研发、测试、制作四个入口可读且可点击。
3. 输入研发交付请求，确认场景上下文与默认工作流来自 `game-studio`。
4. 禁用能力包，确认四个入口消失且普通工作伙伴仍可使用。
5. 重启应用，确认启停状态持久化，控制台无 uncaught error。

## Regression

- 现有 Expert、Skill、Connector Hub 列表和安装状态不受影响
- 办公伙伴与通用 Agent 空状态仍可用
- Renderer 无 Node 文件系统权限
- 旧游戏 Session 可恢复，不改写 agentId

## Evidence

- 开发自测：`evidence/dev-self-test.md`
- 制作人验收：`acceptance.md`
- QA 报告：`evidence/test-report.md`
- 截图：`evidence/screenshots/`
