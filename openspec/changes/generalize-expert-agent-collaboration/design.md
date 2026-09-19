# Design

## 边界与职责

- Agent 包负责专业能力：Persona、SOP、Skill、Connector、输入字段、交付标准和风险约束。
- Electron 主进程负责通用编排：冻结专家快照、预检依赖、投影工具面、执行、证据校验、Artifact 收集、状态恢复和版本化验收。
- 渲染进程只消费任务、对话与 Artifact 契约，不解析专家 ID、工具名文案或成功关键词来推断状态。
- IPC 继续传输结构化 `WorkbenchTask`、`AgentRunArtifact` 和 `artifactRefs`；媒体二进制不复制进任务记录。

## 通用执行契约

每个交付物声明 `type`、`requiredTools`、`requiredEvidence`、`requiredArtifacts`、`minArtifacts` 与 `completionConditions`。运行时按目标选择声明式 route，合并契约并按交付物顺序执行。只有证据和 Artifact 同时满足契约时，任务才进入 `review`。

Provider adapter 的投影只依赖“本轮需要的工具”和“允许的连接器”。同一能力组合对内置专家和第三方专家保持一致。

## 对话与成果

- `answer`：作为专家正常回复进入对话，不制造文件卡片。
- `document`：仅用于 Manifest 明确要求或用户明确要求文件、导出、附件时。
- `image`、`video`、`audio`：由统一 Artifact Preview 契约展示真实资源；状态、验收按钮和说明文字不覆盖媒体。
- 多个媒体 Artifact 保留顺序并共享适配视口；预览使用 `object-fit: contain`，不裁切主体。

## 失败与恢复

工具、授权、能力、证据、成果数量和成果类型分别形成结构化 attention。GET 读取不修复数据；历史修复只在应用启动时运行。执行中输入进入队列，当前步骤结束后自动续跑；应用重启后恢复队列和修订任务。

## 兼容策略

历史 `image-producer` 数据异常由 `expert-task-legacy-migrations` 隔离修复。平台主执行、工具装配和渲染代码不得出现具体专家 ID。旧显示名称映射只作为只读呈现兼容，不影响执行路径。

## 性能与内存

Manifest 在专家快照阶段读取并冻结；任务只持久化引用和有界摘要。图片预览按需加载，多个 Artifact 不复制 base64 到任务对象。轮询沿用现有任务房节奏，不增加后台常驻进程。
