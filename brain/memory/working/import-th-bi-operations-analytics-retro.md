# import-th-bi-operations-analytics retro

## 结果

- 将 th-BI 的“数据靓仔”人格、三轨权威模型、项目漂移规则和 guided 查询 SOP 封装为 KnowMe 官方运营数据分析专家。
- 导入核心分析、飞书填表、TE 页面导出三个 Skill；Playwright 脚本保留原实现，飞书写入新增受控 lark-cli 适配器。
- 盘古协议查询与数数实时分析使用独立最小权限 MCP 配置，外部写入仍需明确确认。
- 108 份 OKF/约定文档成为版本化知识包，启动时同步到 Knowledge OS；受管文件可升级，用户修改冲突会保留。

## 关键决策

- 不扩权既有盘古生图连接器，另建盘古数据只读配置，避免跨专家权限泄漏。
- 不把 Cursor Hook 记忆搬进产品运行时，改用 KnowMe 自身会话记忆和知识提案流程。
- 不自动复制全局 Cursor 密钥或内部地址；连接器只提供模板和 secret slot，由能力中心授权。

## 验证

- 新增专家、Skill、连接器与知识同步专项测试通过。
- 全量 Node 测试、lint 与 TypeScript 检查通过。
- Renderer 全量测试有一个既有图片预览用例失败；相关 UI 文件在本任务开始前已处于大幅修改状态，本次未触碰。

## 后续

- 在能力中心安装专家并为 `pango-data-mcp`、`thinkingdata-analysis-mcp` 配置现有服务地址。
- 用真实项目分别做一次 DAU guided query、盘古事件校验、TE CSV 导出和飞书 preview/write 验收。
