# Agent Capability Hub 复盘

- 日期：2026-08-04
- Change：`agent-capability-hub`
- 结果：统一交付专家、技能、连接器三类能力的分发、安装、个人开发、运行时接线与管理页面。

## 有效做法

- 先建立统一 capability store/catalog，再分别接 Skill、Expert、Connector Runtime，降低主进程耦合。
- `SKILL.md` 采用 L0 元数据、L1 正文、L2 资源、L3 脚本的渐进披露，避免能力规模增长时挤占上下文。
- Expert Session 使用 capability snapshot 冻结 persona 与绑定，避免全局编辑影响历史会话。
- 多 MCP 使用 `mcp.<connectorId>.<tool>` 命名空间与 allowlist，显式拒绝冲突。
- 在功能开发前修复 Python/Node 沙箱禁网绕过，并用回归测试锁定。

## 风险与后续

- 权限升级当前从下一轮 Agent run 生效；后续可支持同轮热更新。
- Electron 自动化尚不能驱动原生窗口，精选安装、专家试聊、slash/JIT 卡片保留为 E2E advisory。
- Hub 切换 Tab 时可进一步主动清空旧详情抽屉。
- ZIP 50MB 与 500 文件边界已有代码限制，后续补专门的大包边界测试。

## 证据

- 自动化：885 tests PASS，lint PASS。
- 门禁：制作人验收 PASS、QA PASS、harness gate PASS。
- 截图：`openspec/changes/agent-capability-hub/evidence/screenshots/`。
