# RQA175 — 通用 Skill 工具预检闭环

## 问题

保留专家 roster 增量纳入 Crawl4AI 专家和舆情专家后，二者的执行路线都声明了 `run_skill_script`。专家任务预检只把基础平台工具和连接器投影加入注册表，没有注册 Skill 工具定义，因此会把已绑定、已启用的 Skill 错误判定为“联合工具面未提供必需工具”，任务在执行前进入 `needs_input`。

## 修正

- Skill 工具定义通过统一的 `SKILL_TOOL_DEFINITIONS` 导出。
- 专家任务预检按当前任务声明的必需工具，从同一组 Skill 工具契约注册到联合工具面。
- 预检仍由专家绑定、Skill 安装/启用状态、任务权限和工具 allowlist 共同决定，不绕过任何授权检查。
- 未添加专家 ID、专家名称或专项平台分支；未来新增 Skill 脚本路线复用同一契约。
- AgentEvals roster 断言改为读取专家治理配置的 `disposition=keep`，避免目录增量后测试继续固化旧数量。

## 验证

- 专家矩阵 + AgentEvals：`16/16` 通过，8 个当前保留专家均可进入 review 并完成验收；配置失效场景均保持可恢复的 `needs_input`。
- 完整后端测试：`3554` 项，`3503` 通过、`51` 跳过、`0` 失败。
- 完整 `npm run check`：backend `3554`（`3503/51/0`）、Renderer `86` 文件 `633/633`、lint、typecheck 均通过。

这项修复证明通用运行时能正确承接 Skill 工具契约，不等同于 Crawl4AI、舆情或其它专家已经通过真实外部服务和独立专业质量评审。
