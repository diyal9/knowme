# Code Review

日期：2026-08-22

## Review summary

- 主进程独占密钥解密与 MCP 连接；preload 只暴露脱敏 DTO 和有限写命令。
- 三种传输共用 session contract，Agent 工具继续进入既有 Tool Surface / Tool Runtime，没有第二套执行器。
- 未命中工具策略时采用需要审批的保守外部副作用契约。
- 外部导入的 env/header/URL 凭据不写入 manifest、公开预览、哈希输入或日志。
- 工作流依赖保持为一等字段并进入快照哈希；启动门禁对必需与可选依赖分别处理。

## Findings

未发现阻止合并的本 change 缺陷。真实 Adobe/Creator 进程联调依赖用户本机服务与授权，不在自动化测试环境中伪造成功。
