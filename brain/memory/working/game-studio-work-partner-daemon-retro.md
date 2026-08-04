# Retro: game-studio-work-partner-daemon

## 做了什么

- 将 KnowMe 垂直化为手机游戏研发工作伙伴：`industry=game` 时四场景 Skill 驱动（策划/研发/QA/制作）。
- 新增结构化游戏需求案（八段式 parse/validate/approve）与 Workbench Daemon handoff（诚实 offline 阻断 + 真实 workflow 选择）。
- 保留 legacy agentId 兼容与左 Rail；UAT 截图 + Word 报告 + 906 测试。

## 经验

- OpenSpec delta spec 必须用 `## ADDED Requirements` + `### Requirement:` + `#### Scenario:` 格式，否则 validate 失败。
- Daemon live E2E 依赖本机 8010 服务；offline 路径可用契约测试 + Playwright 静态预览覆盖。
- 飞书真实 OAuth 未在本机验证，报告须标注 fixture/契约范围。

## 后续

- Electron 真机 + Daemon 在线时补 live handoff E2E。
- 将 game 场景与工作台任务卡 trace（sceneId/skillId）进一步 UI 可视化。
