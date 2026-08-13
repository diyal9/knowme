## 1. Hub 专家入口

- [x] 1.1 将专家详情主操作改为“安装并开始 / 启用并开始 / 开始对话”，并为异步准备过程提供防重复与真实错误反馈（capability-hub）
- [x] 1.2 安装或启用成功后发送受控专家启动意图，并接收工作区成功/失败回执（capability-hub、agent-session-tabs）

## 2. 工作区 Session 交接

- [x] 2.1 在工作区校验当前 Hub frame 消息来源，成功创建 Session 后再关闭 Hub（agent-session-tabs）
- [x] 2.2 暴露 WorkspaceAgent 专家启动入口，复用普通 Session 创建、Tab 激活、草稿隔离与输入框聚焦（agent-session-tabs、expert-runtime）

## 3. 专家身份与依赖降级

- [x] 3.1 为专家 Session 提供 persona 与绑定依赖的轻量展示投影，缺依赖时保留 persona-only 会话（expert-runtime）
- [x] 3.2 在专家空状态展示名称、说明、建议任务、能力就绪摘要及“去配置”动作（agent-session-tabs）
- [x] 3.3 保持 context assembly 与工具投影只使用当前已启用、已授权且 allowlist 允许的绑定能力（expert-runtime）

## 4. 运行时收敛与兼容

- [x] 4.1 统一 renderer 到 `agent-session-new` 的专家 Session 创建路径，停止使用会产生孤立对象的 `expert-try-chat`（expert-runtime）
- [x] 4.2 验证普通专家 Session 持久化、重启恢复及快照不随专家更新/卸载漂移（expert-runtime、agent-session-tabs）

## 5. 验证与证据

- [x] 5.1 增加 Hub CTA、来源校验、Session 激活、依赖降级和错误不误报成功的自动化测试（三项修改规格）
- [x] 5.2 执行 lint、测试和 Electron 核心路径冒烟，记录 `evidence/dev-self-test.md`（三项修改规格）
