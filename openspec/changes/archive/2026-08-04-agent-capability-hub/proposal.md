# Proposal: agent-capability-hub

## Why

KnowMe 的 Agent 能力（技能、专家、连接器）分散在设置页、OKF 知识库与零散 MCP 配置中，用户难以发现、安装与个人扩展；旧版 OKF slash skill 与 agentskills.io / Claude Code / Cursor 的 `SKILL.md` 生态不互通，限制了能力分发与开发者复用。现在需要统一入口与运行时，让用户像使用「应用商店」一样管理 Agent 能力，并为个人开发者提供从精选目录到本地/ZIP/HTTPS 导入与自定义创建的完整链路。

## What Changes

- 左侧 rail 新增三个仅图标入口（专家 / 技能 / 连接器），均打开同一全屏 **Capability Hub**；Hub 顶部三 Tab，视觉参考腾讯元器：浅色克制、搜索、精选、分类 chips、已安装、添加/自定义、三列卡片、详情抽屉
- 统一 **capability catalog + install store**：内置精选目录 + 本地文件夹 / ZIP / HTTPS 导入 + 自定义创建；支持安装 / 卸载 / 启用 / 更新
- **Skill Runtime**（重点）：兼容 `skills/<id>/SKILL.md`（agentskills.io / Claude Code / Cursor）；frontmatter `name` / `description` / `disable-model-invocation`；`references/` / `scripts/` / `assets/` 三级渐进披露；Agent tools `list_skills`, `load_skill`, `read_skill_resource`, `run_skill_script`；旧 OKF slash skill 双轨迁移；description 自动匹配 + `/slash` 手动触发
- **Expert Runtime**：`EXPERT.md` / manifest；动态专家目录；persona 注入；绑定 skills / connectors；session 冻结版本快照；精选 / 安装 / 创建 / 编辑 / 试聊
- **Connector Runtime**：curated templates；自定义 MCP；多 MCP 并行；health / tools preview / allowlist；保留飞书 JIT auth 与写草稿审批
- 用户数据统一在 `%APPDATA%\KnowMe\capabilities\`；导入安全（zip traversal、大小、文件数、协议、软链接、信任来源）；secret 不落盘
- Skill scripts 复用 sandbox，**先修** Python urllib/requests/socket 与 `node -e fetch` 可绕过默认禁网的问题；危险 / 联网 / 写入需明确授权
- 统一交付门禁：npm test/lint、Electron 真机、UI 截图、dev-self-test、producer acceptance、QA test-report、code-review、gate/story-done

## 目标用户

- **C 端知识工作者**：希望一键安装「写作专家 + 飞书连接器 + 会议纪要技能」，无需理解 MCP 或 OKF
- **个人开发者 / 高级用户**：希望导入 Cursor/Claude Code 技能包、自建 MCP、发布 ZIP 分享给团队
- **制作人 / QA**：需要可验收的统一能力管理面，替代分散的设置页入口

## 验收标准

- 三个 rail 图标均可打开 Capability Hub 并定位到对应 Tab
- 三类能力均完成：精选浏览 → 安装 → 启用 → Agent 可用 → 卸载
- Skill Runtime 可加载标准 `SKILL.md` 包并通过四个 skill tools 渐进披露；旧 OKF slash skill 仍可用且可迁移
- Expert 可创建/编辑/试聊，Session 绑定版本快照不随全局更新漂移
- Connector 多 MCP 并行、allowlist、飞书 JIT auth 与写草稿审批行为不退化
- 导入恶意 ZIP / 超大包 / 非 HTTPS 均被拒绝；secret 不出现在磁盘明文
- 沙箱禁网绕过漏洞已修复并有回归测试
- 全部门禁证据齐全（见 qa-plan.md / acceptance.md）

## 非目标（Non-goals）

- 云端能力市场后端、付费结算、多用户协作审核（本期仅内置精选 + 本地/HTTPS 导入）
- 技能包在线编辑 IDE、Git 版本控制 UI（仅文件级导入/导出）
- 替换 `%APPDATA%\KnowMe\knowledge\` OKF 产品知识库（能力 Hub 与 OKF 并存，slash OKF 双轨过渡）
- 移动端 / Web 独立客户端
- 自动将 Hub 内技能同步到 Cursor 全局 skills 目录

## Capabilities

### New Capabilities

- `capability-hub`: 全屏 Capability Hub UI、rail 入口、统一 catalog/install store、导入安全与生命周期
- `agent-skills-runtime`: SKILL.md 解析、渐进披露、skill tools、OKF slash 双轨迁移与触发
- `expert-runtime`: EXPERT.md 专家定义、persona 注入、skills/connectors 绑定、session 快照与试聊

### Modified Capabilities

- `slash-skill`: 从设置页抽屉迁移到 Hub；与 SKILL.md runtime 双轨；保留 `/slash` 手动触发
- `connector-sdk`: Hub 内连接器管理；curated templates；与统一 install store 集成
- `agent-mcp-host`: 多 MCP 并行；Hub 内 health/tools preview；与 allowlist 联动
- `agent-context-assembly`: 注入 expert persona、skill 自动匹配摘要、session 冻结快照
- `agent-session-tabs`: Session 绑定 expert 与 capability 版本快照
- `workspace`: 左侧 rail 三图标入口与 Hub 全屏路由
- `agent-tool-execution`: 沙箱禁网绕过修复；`run_skill_script` 授权模型

## Impact

| 区域 | 影响 |
|------|------|
| `src/workspace.html` / rail | 三图标入口、Hub 全屏层 |
| `src/lib/capability-*`（新） | catalog、install store、import 安全 |
| `src/lib/skill-runtime*`（新） | SKILL.md 解析与 tools |
| `src/lib/expert-runtime*`（新） | EXPERT.md、persona、快照 |
| `src/lib/connector-*` | Hub 集成、多 MCP |
| `src/lib/agent-*` | context 装配、tool 表、沙箱 |
| `%APPDATA%\KnowMe\capabilities\` | 新用户数据根 |
| `tests/` | catalog、import 安全、skill tools、沙箱回归 |
| IPC | `capability:*`, `skill:*`, `expert:*` 新通道 |
