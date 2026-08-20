# QA Plan

## Smoke Scope

- [x] 扫描 `.cursor/skills`、`.cursor/agents`、`.cursor/mcp.json`、`.cursor/workflows`。
- [x] 工作流节点中的源 Agent ID 映射为实际安装专家 ID。
- [x] `next`、批准、驳回、返工和失败路由转换为图边。
- [x] deprecated / hidden 工作流只预览、不安装。
- [x] 未确认时拒绝写入；预览内容变化时复用既有防陈旧校验。
- [x] 导入专家只在自己的会话获得预览/导入工具。

## Security

- [x] 工作流路径限制在 `.cursor/workflows`，拒绝越界和符号链接。
- [x] 预览不返回工作流正文、系统提示词或连接器敏感值。
- [x] 外部文档不作为授权指令；导入不执行外部脚本。
- [x] `th-art` 的明文 Authorization SSE 连接器被阻止且未复制凭据。

## Regression

- [x] 导入域 Node 测试 31/31。
- [x] 能力中心 Renderer 测试 14/14。
- [x] lint 与 renderer typecheck 通过。
- [ ] 全仓 `npm run check`：被同一脏工作区中的既有、非本 change 失败阻塞，详见 `evidence/test-report.md`。
