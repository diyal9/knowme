# Capability Hub 样例结构

KnowMe Capability Hub 将专家、技能、连接器统一存放在 `%APPDATA%\\KnowMe\\capabilities\\`。应用内置精选位于 `src/catalog/`，用户安装后写入 AppData。

## 目录布局

```
capabilities/
  install-store.json
  catalog-overlay.json
  skills/<id>/SKILL.md
  experts/<id>/EXPERT.md
  connectors/<id>/manifest.json
  agent-registry/<id>/index.json
  agent-registry/<id>/revisions/<revision>.json
  imports/staging/
  snapshots/<sessionId>/
```

## SKILL.md（agentskills.io 兼容）

```markdown
---
name: writing-polish
description: 优化文案结构、语气一致性与可读性
version: 1.0.0
disable-model-invocation: false
---

# 写作润色
...
```

可选子目录：`references/`、`scripts/`、`assets/`（运行时由 Skill Runtime 渐进披露，安装阶段仅落盘）。

## EXPERT.md

```markdown
---
name: product-manager
description: 产品定义、用户研究与需求评审专家
version: 1.0.0
avatar: product
skills:
  - product-requirement-analysis
connectors:
  - mcp-generic
systemPrompt: |
  你是 KnowMe 产品经理...
---
```

配套 `manifest.json` 记录绑定关系与版本快照元数据。

## Runtime Agent Registry（v0.5.0）

运行时创建专家不再要求向 `src/catalog/` 写代码。伙伴或 Agent 运维 Skill 提交完整专业 Definition，经 `verify → preview → 用户确认/宿主审批 → commit` 后，复用 Expert Runtime 写入 `%APPDATA%\\KnowMe\\capabilities\\experts/<id>/`，并在 `agent-registry/` 保存不可变 revision。

Definition 至少包含职责、Soul、SOP、方法型 Skill、适用场景、边界、输入输出、执行路线、交付物、质量复核、权限与风险。下架只关闭新任务并清理入口，保留专家包、历史任务快照和 revision；恢复与回滚同样必须先预览，回滚生成新 revision 而不覆盖历史。

四个通用受控操作为 `verify_agent_definition`、`preview_agent_change`、`commit_agent_change`、`list_agent_revisions`。其中 commit 是宿主审批写操作；模型参数不能代替用户确认或授予权限。

## Connector manifest

```json
{
  "id": "feishu",
  "kind": "connector",
  "type": "feishu",
  "version": "1.0.0",
  "cli": {
    "command": "lark-cli",
    "args": []
  }
}
```

飞书连接器由 KnowMe 内置的 `lark-cli` 适配器执行，登录态由 lark-cli 管理；不要在 manifest 中配置第三方 MCP 服务、应用密钥或明文 token。其他通用 MCP 连接器仍可使用 `mcp` 字段。

**Secret 规则**：manifest 中仅允许 `env:VAR_NAME` 占位，禁止明文 token / apiKey。

## 导入来源

| 来源 | 说明 |
|------|------|
| curated | 内置精选，自 `src/catalog/` 复制 |
| local | 本地文件夹或单文件 SKILL.md / EXPERT.md / JSON |
| zip | ZIP 包（先校验 traversal/大小/文件数，再解压到 staging） |
| https | 仅 `https://` 的 `.zip` 或 `.json` |
| custom | 向导生成的最小合法目录 |

## 公开 API（主进程）

- `capability-store.js` — install store CRUD、enable/disable、atomic write
- `capability-catalog.js` — bundled seed + overlay 合并
- `capability-import.js` — 安全导入与 curated 安装

IPC 由 Capability Hub 主进程统一注册，Renderer 不得直接读写 capabilities 目录。
