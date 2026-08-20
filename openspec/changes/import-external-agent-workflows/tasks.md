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

- [ ] 定义可扩展的外部工作流运行配方、输入 Schema 和旧包运行时升级
- [ ] 实现启动预检：仓库、PSD、Node、固定脚本、输出目录与 Creator 工程
- [ ] 实现 shell=false 的固定脚本执行器、超时/取消、日志脱敏和路径边界
- [ ] 将 th-art PSD 探测、切图出包、Creator 预检/导入/结构验收接入确定性工具节点
- [ ] 工作台启动接入预检并展示可操作的阻塞原因
- [ ] 补充单元测试、兼容性测试与端到端验证
