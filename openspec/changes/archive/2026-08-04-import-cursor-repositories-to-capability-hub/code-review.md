# Code Review: import-cursor-repositories-to-capability-hub

## Scope

- Cursor 仓库扫描、预览缓存与幂等注册
- install store / catalog overlay 的链接来源模型
- Skill / Expert / Connector Runtime 接入
- Electron IPC、preload 与能力 Hub 导入交互
- 单元、集成和静态 UI 契约测试

## Review Checks

- [x] Renderer 不直接访问文件系统，仓库扫描与写入均在主进程
- [x] 扫描限制在固定 `.cursor` 子树并设置文件、目录数量上限
- [x] 链接技能的 realpath 同时受仓库根和技能目录约束
- [x] MCP 环境变量值不写盘，明文敏感字段阻止注册
- [x] 预览 token 有容量与时效限制，确认前重新扫描避免陈旧预览写入
- [x] ID 冲突使用稳定仓库前缀，重复导入不会产生重复项
- [x] 旧 install-store 字段保持向后兼容
- [x] 非精选安装项即使缺少 overlay 也可诚实显示
- [x] `git diff --check`、lint、完整测试无异常

## Findings

- BLOCKING：无
- ADVISORY：当前 Connector Host 仅支持 stdio，`creator_mcp` 非 stdio 配置会提示并跳过；应在后续独立 Story 评估 HTTP/SSE MCP。

## Conclusion

Review PASS，可进入 QA 与 Story 门禁。
