# Implementation

- [x] 1. 定义并兼容 Connector Package / Instance、配置字段、密钥槽和逐工具策略
- [x] 2. 实现 safeStorage 密钥仓库与公开脱敏视图
- [x] 3. 统一 stdio、Streamable HTTP、legacy SSE MCP 会话工厂
- [x] 4. 完成工具发现、允许列表、风险策略、健康状态和 Tool Receipt 对接
- [x] 5. 实现 Agent / Skill / Workflow 连接器依赖解析与启动门禁
- [x] 6. 扩展外部项目扫描，安全导入 HTTP/SSE/stdio 声明并剥离明文密钥
- [x] 7. 在能力中心实现连接器配置、密钥、测试、工具授权和引用管理
- [x] 8. 增加 Photoshop MCP 与 Cocos Creator MCP 首批连接器包
- [x] 9. 迁移 PSD → ArtBundle 工作流依赖、工具引用、降级路径与验收回执
- [ ] 10. 补齐单元、IPC、渲染层和工作流测试并通过 `npm run check`

> 2026-08-22：本 change 的 Node 测试、能力中心 19 项渲染测试、lint 与 typecheck 均通过。`npm run check:quick` 仍被当前工作区中与本 change 无关的 4 项既有 UI/CSS 契约失败阻塞，详见 evidence/test-report.md。
