## Implementation

- [x] 扫描 Cursor 工作流并纳入防陈旧内容哈希
- [x] 映射外部 Agent、Skill、Gate 和边为 Workflow Package v2
- [x] 注册 team/draft 工作流并报告 ID 映射、跳过与失败项
- [x] 新增独立“智能体运维专员”及其对话内预览/确认工具，不发布同名 Skill
- [x] 能力中心预检展示工作流数量
- [x] 使用 th-art PSD → ArtBundle 完成真实扫描与临时目录端到端注册
- [x] 补充单元测试和使用文档
- [x] 智能体运维专员支持目标 Workflow 选择、依赖闭包规划、规划 token 精确导入和安装后验证
- [x] th-art 精确包验证：1 Workflow + 2 Expert + 10 Skill，13 项成功且 17 节点/5 门禁验证通过

## External workflow execution

- [x] 定义可扩展的外部工作流运行配方、输入 Schema 和旧包运行时升级
- [x] 实现启动预检：仓库、PSD、Node、固定脚本、输出目录与 Creator 工程
- [x] 实现 shell=false 的固定脚本执行器、超时/取消、日志脱敏和路径边界
- [x] 将 th-art PSD 探测、切图出包、Creator 预检/导入/结构验收接入确定性工具节点
- [x] 工作台启动接入预检并展示可操作的阻塞原因
- [x] 补充单元测试、兼容性测试、真实包编译与真实 th-art 只读预检

## Unified Agent Tool Runtime

- [x] 新增统一 Agent Tool Runtime，兼容旧工具名并支持 `toolRef`
- [x] 为 PSD→ArtBundle 确定性动作注册正式 Tool Contract 和版本化引用
- [x] 工作流 Tool 节点通过统一 Executor 执行并生成 Tool Receipt
- [x] 将工作流运行权限传入外部工具执行上下文，避免绕过治理策略
- [x] 增加 Tool Runtime 单元测试并通过全量测试、lint、类型检查
- [x] 对声明 requiredTools 的任务在模型循环中强制工具调用，避免仅输出说明文本
- [x] 每轮工具结果实时写回 Tool/Evidence Ledger，确保后续轮次与最终验收可见
- [x] 将导入类结构化结果识别为有效证据，避免 token/counts/verification 被误判为内容不足
- [x] 导入专家在证据不足或工具失败时自动诊断并重试，不提前结束为“请补充信息”
- [x] 外部项目预览识别 knowledge/docs/rules 文档，并支持 source 保留或 rag 入库策略
- [x] PSD→ArtBundle 将 Creator 工程降为高级/已配置依赖，主输入聚焦 PSD 文件
