## 1. 协议与纯状态模块

- [x] 1.1 新增版本化 `agent-output-protocol`，实现 lane/type 常量、单调 seq emitter、事件校验与 legacy 映射
- [x] 1.2 新增 `agent-output-assembler`，实现 roundDraft/candidate、canonical hash、suggestion 剥离与有界 diagnostics
- [x] 1.3 新增 `agent-message-state` reducer，覆盖状态迁移、幂等 seq、terminal 冻结与 answer/ui 分区
- [x] 1.4 为协议、assembler 与 reducer 增加确定性 Node 单测

## 2. 执行器缓冲与 canonical commit

- [x] 2.1 将工具可用 MODEL 轮的 snapshot 改为仅更新缓冲，不再直接 emit 可见正文
- [x] 2.2 在 postProcess、grounding、claim verify、output gate、regen 与 normalize 后构建 canonical answer
- [x] 2.3 按顺序发送 `answer.committed`、可选 `choice.ready` 与唯一 terminal 事件
- [x] 2.4 持久化 canonical text/hash/protocolVersion/ui，并保证公开 result 可克隆且不提供覆盖正文的副本

## 3. Electron IPC 单一事件流

- [x] 3.1 在生产 Run adapter 与 main handler 中接入 v2 emitter，停止 workspace 正文双发
- [x] 3.2 更新 preload 订阅边界与兼容映射，确保同一 Run 只消费一个正文来源
- [x] 3.3 增加 IPC 结构化克隆、单调顺序、重复/迟到和取消/错误终态测试

## 4. Renderer 状态机与稳定消息骨架

- [x] 4.1 `workspace-agent` 使用 reducer 消费 v2 事件并维护 timeline/answer/ui/terminal 状态
- [x] 4.2 固定助手消息的 execution、response、structured-ui 与 actions 区域，正常 Run 只做局部 patch
- [x] 4.3 移除 workspace 正常路径的 chunk 正文消费、invoke finalText 覆盖与 typewriter fallback
- [x] 4.4 保留发送强制到底与用户上滑优先，完成/取消/错误均不全量重建历史消息

## 5. 结构化 UI 与旧会话兼容

- [x] 5.1 将 suggestion/thinking 协议块在 commit 前解析并转成 `choice.ready`，非法或半截 JSON 零泄漏
- [x] 5.2 新消息保存可选 `ui/protocolVersion/answerHash`，旧消息加载时惰性提取并保持可读
- [x] 5.3 增加 fenced、bare、非法、半截 suggestion 与旧会话恢复测试

## 6. 行为门禁与团队验收

- [x] 6.1 增加 DOM/Electron fixture，验证历史/气泡/正文节点身份、正文零回滚、滚动与 pending review
- [x] 6.2 增加事件诊断元数据与零敏感内容检查，记录 buffer/commit/duplicate/late 指标
- [x] 6.3 运行定向测试、完整 `npm test`、`npm run lint`、OpenSpec strict validate 与 harness gate
- [x] 6.4 重启 KnowMe 完成开发自测，写 `evidence/dev-self-test.md` 与截图/JSON
- [x] 6.5 完成制作人体验验收与 Tester 正式 QA，修复阻断项并归档 change
