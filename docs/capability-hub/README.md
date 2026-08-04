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
name: office-partner
description: 日常办公多能力专家
version: 1.0.0
avatar: office
skills:
  - writing-polish
connectors:
  - feishu
systemPrompt: |
  你是 KnowMe 办公伙伴...
---
```

配套 `manifest.json` 记录绑定关系与版本快照元数据。

## Connector manifest

```json
{
  "id": "feishu",
  "kind": "connector",
  "type": "feishu",
  "version": "1.0.0",
  "mcp": {
    "command": "npx",
    "args": ["-y", "@larksuiteoapi/lark-mcp"],
    "env": {
      "LARK_APP_SECRET": "env:LARK_APP_SECRET"
    }
  }
}
```

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

IPC 层将在后续 task 中接入，Renderer 不得直接读写 capabilities 目录。
