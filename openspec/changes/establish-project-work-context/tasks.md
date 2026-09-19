## Project foundation

- [x] 1.1 定义 Project、ProjectContext、ProjectBinding 与 Artifact origin 共享契约
- [x] 1.2 实现 Project Store、确定性 Source 兼容迁移和生命周期校验
- [x] 1.3 注册 Project IPC、preload API 与启动组合根
- [x] 1.4 增加 Project Store、迁移和 IPC 单元测试

## Renderer project context

- [x] 2.1 增加 Project 状态、加载、选择和 Source 兼容派生
- [x] 2.2 将“文件”入口升级为“项目”侧栏，保留现有文件树能力
- [x] 2.3 增加无项目、目录丢失、归档和只读状态
- [x] 2.4 增加项目侧栏和切换稳定性 Renderer 测试

## Entity ownership

- [x] 3.1 为 WorkbenchTask 增加兼容读取的 projectId 和运行快照
- [x] 3.2 为 AgentSession、Artifact 和自动化绑定增加可选 projectId
- [x] 3.3 新文件操作改为显式 Project Context 解析，并保留 legacy adapter
- [x] 3.4 增加切换当前项目不重定向既有实体的回归测试

## Brain and product integration

- [x] 4.1 为 Brain Node/Claim/Evidence 增加项目范围和证据打开上下文
- [x] 4.2 为伙伴、工作台、自动化和 Brain 增加一致的项目标签/筛选入口
- [x] 4.3 增加项目归档、missing 和重新定位行为测试

## Verification

- [x] 5.1 运行 OpenSpec strict validation
- [x] 5.2 运行相关 Node/Renderer 测试、lint 和 TypeScript 检查
- [x] 5.3 运行 `npm run check` 并记录非本变更阻塞
- [x] 5.4 完成 GitNexus 变更范围检测、制作人验收与测试 QA 记录
