# Code Review: establish-project-work-context

## 结论

通过，无未解决的阻断项。

## 架构审查

- Project 是工作上下文与所有权边界，Source 继续承担内容接入，Brain 继续承担跨项目认知，三者没有合并成一个含混概念。
- `activeProjectId` 只用于导航、筛选和新建默认；运行链使用实体上的 `projectId` 或创建时快照。
- 未绑定会话在工具面构建时只捕获候选项目，首次项目操作前持久化；项目切换不会改变已捕获或已绑定的根目录。
- Agent 文件工具从 Project Context 获取唯一可写 workspace；reference sources 保持只读。
- 项目归档、detach 与 relink 只修改元数据，不执行工作区删除。

## 兼容性审查

- 既有 Source 通过确定性 ID 迁移，旧 Source API 与文件树仍保留作为兼容适配层。
- `projectId`、`projectSnapshot` 和 origin 字段均为兼容新增；旧 Task、Session、Artifact 与 Automation 可继续读取。
- Renderer 会话解析显式保留新增字段，避免主进程持久化后在 UI 投影层丢失。

## 安全与失败关闭

- 显式项目不可用时不回退当前 Source，避免静默写入错误目录。
- 首次会话绑定持久化失败时，文件/进程/成果工具不执行。
- missing、archived、readonly 的自动化和文件产出型 Agent Graph 在执行前阻断。
- 输出策略只约束新正式成果默认目录，不重定向既有文件编辑。

## 评审备注

整仓 GitNexus critical 评级来自 255 个并行未提交文件的合并范围；本 change 的专项影响分析与测试未发现越界修改。未替用户清理、覆盖或提交任何既有工作区改动。
