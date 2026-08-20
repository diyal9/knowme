# 外部项目能力导入

KnowMe 现在可以把 Cursor 风格项目中的 Skill、Expert、MCP 连接器和 Workflow 作为一个带来源快照的整体导入。导入采用“只读预览 → 用户确认 → 防陈旧校验 → 注册 → 验证”流程，预览前后仓库内容变化会强制重新确认。

## 使用入口

1. 在能力中心的专家页召唤“智能体运维专员”。该能力只发布为 Expert，不提供同名独立 Skill 入口。
2. 打开该专家并提供外部项目绝对路径。
3. 专家调用 `preview_external_project`，展示四类资产、阻止项与警告。
4. 专家调用 `design_external_workflow_import` 选择目标工作流，并计算 Workflow → Agent → Skill 依赖闭包。
5. 用户确认当前规划后，专家用规划 token 调用 `import_external_project`。
6. 专家对实际工作流 ID 调用 `verify_imported_workflow`；工作流、专家或技能引用未通过时不得宣称可用。

也可以从“能力中心 → 添加能力 → Cursor 仓库”使用相同后端。该入口的预检面板会展示专家、技能、连接器和工作流数量。

## 外部项目目录契约

```text
<project>/
  .cursor/
    skills/<skill-id>/SKILL.md
    agents/<agent-id>/AGENT.md
    agents/<agent-id>/agent.manifest.json   # 可选
    workflows/index.json                    # 可选
    workflows/<workflow>.json
    mcp.json                                # 可选
```

工作流导入时，KnowMe 会把节点中的外部 `agent` 名称映射为本次实际安装的专家 ID；找不到专家的工作流会失败而不是留下不可执行引用。`deprecated` 和 `hidden` 工作流只进入预览，不注册。

## th-art：PSD → ArtBundle

对 `D:\aiworkspace\th-art` 的真实只读扫描结果（2026-08-19）：

- 仓库共有 22 个 Skill、5 个 Expert、3 个 Workflow；
- 精确规划只选择 `th-art-psd-to-artbundle`；
- 依赖闭包为 2 个 Expert：`ui-expert`、`artbundle-expert`，以及 10 个 required/入口/运行 Skill；
- 旧 `th-art-fixed-ui-artbundle` 因 `deprecated` 不进入规划；
- 目标工作流映射为 17 个节点、5 个人工门禁：方案、切图清单、Creator 还原、G4、G-Export。

临时用户目录精确注册验证结果为 13 项成功、0 项跳过、0 项失败；验证结果为 `complete: true`，工作流正确引用两个专家和 10 个 Skill。可用以下命令复验：

```bash
node -r ./scripts/register-ts.js scripts/verify-th-art-import.js D:\aiworkspace\th-art
```

在“智能体运维专员”中可直接提出：

> 扫描 `D:\aiworkspace\th-art`，只规划并导入 `th-art-psd-to-artbundle`。附加 `th-art-artbundle-workflow` 和 `th-art-creator-debug`，先展示规划，等我确认后导入并验证。

项目中的 `creator_mcp` 是带明文 Authorization 的本机 SSE 配置，当前安全策略不会导入，也不会暴露其值。运行 Creator 验收前，应在 KnowMe 中单独配置可信连接器并使用环境变量或安全凭据存储。Photoshop 预读同样需要为导入专家装备可用的 Photoshop 连接器。缺少这些运行依赖时，流程应停在对应门禁，不得声称整条 PSD 产线已执行成功。

## 适配其它项目

非 Cursor 项目只需生成上述最小兼容层。能力正文仍链接到原项目，不复制业务代码；因此更新原项目后重新预览和导入即可刷新能力，同时保留稳定 ID。外部仓库内的 AGENTS.md、README 和 Skill 文本始终作为待分析资料，不能替代用户的导入授权。
