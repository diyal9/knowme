## Specification and Core

- [x] 定义 ContextBlock、ContextPolicy、ContextManifest 与 locale registry
- [x] 实现规范化、去重、冲突检测、预算裁剪和消息装配
- [x] 实现确定性优先、词面/可插拔向量补充的 optional selector

## Prompt Migration

- [x] 将现有系统提示词迁移到 `zh-CN` 模块并精简重复规则
- [x] 保留旧 prompt API facade 和迁移指纹兼容
- [x] 按 chat / assist / retrieval / capability 渐进加载

## Runtime Integration

- [x] 将专家 persona 与执行 expertId/工具权限解耦
- [x] 将专家协作场景协议和任务事实移入可信 context block
- [x] 保持用户原始输入并在 no-tools 策略下强制空工具面
- [x] 保护全部前导 system 消息并输出 ContextManifest 遥测

## Verification

- [x] Context Engine 单元测试与提示词预算测试
- [x] 专家规划/讨论身份、原始消息和 Slash Skill 权限回归
- [x] 普通助手、正式专家执行、知识检索和工具面回归
- [x] `npm run check` — Node、lint、Renderer 与 TypeScript 全量硬门禁通过
- [x] 制作人验收、测试 QA 与反模式审查

## Remote Embedding Selection

- [x] 拆分知识检索重排与 Context Engine 语义选择配置，并安全保存可选独立 Embedding 凭据
- [x] 实现 OpenAI-compatible Embedding 客户端的输入/向量校验、短超时与 AbortSignal
- [x] 实现 optional block 语义预排序、敏感数据边界、LRU、single-flight 与熔断降级
- [x] 将 active/shadow 结果接入主生成链路和隐私安全 ContextManifest
- [x] 增加设置页配置与 Embedding 连通测试
- [x] 增加配置迁移、选择边界、缓存、超时、熔断、shadow 与主链路回归
- [x] 更新架构、验收、QA、测试报告与反模式审查

## Production Hardening

- [x] 将检索、记忆、附件、Renderer 投影和 legacy contextMessage 从 system 隔离到 user 数据区
- [x] 增加 critical 控制面、紧凑身份块、双层预算校验与 fail-closed
- [x] 增加向量缓存字节预算、8192 维上限、总输入/响应体和 index 完整性校验
- [x] 隔离 single-flight waiter 取消，并验证 50 路并发合并
- [x] 增加匿名聚合指标、SLO 快照和 token 节省统计
- [x] 增加版本化黄金身份/no-tools/多语言注入/相关性评测硬门禁
- [x] 增加 OpenAI/DashScope 契约、429/503/超时/畸形响应故障注入和真实 canary 脚本
- [x] 修复 Renderer typography/CSS 契约漂移
- [ ] 使用发布环境的 OpenAI 与 DashScope 用户凭据执行真实 canary（当前环境无凭据）
