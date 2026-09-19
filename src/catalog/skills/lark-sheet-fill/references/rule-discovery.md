# 规则发现与存储

## 1. 发现顺序

用户给出 **飞书 URL / token / 别名 / 自然语言表名** 时：

1. **个人记忆** — 读 `<memory_root>/lark-sheet-fill/index.yaml`
   - 匹配 `alias[]`、`target.url`、`target.spreadsheet_token`、`target.base_token`
   - 命中 → 加载同目录 `rules/<id>.yaml`
2. **OKF Wiki** — 搜 `kb/okf/semantic/playbooks/lark-sheet-fill-*.md`
   - frontmatter `type: Playbook` 且含 `lark_sheet_fill_rule_id` 或正文 ` ```yaml fill_rule ` 块
3. **语义兜底** — 读 memory `working/recent.jsonl` 中 `habit` / `analysis_workflow` 是否提及同一 URL
4. **均未命中** → [onboarding-questions.md](onboarding-questions.md) 创建规则流程

解析 memory 根路径：

```bash
python -c "import sys; sys.path.insert(0, '.cursor/hooks'); import memory_paths as m; print(m.memory_root())"
```

## 2. 个人记忆布局

```
<memory_root>/lark-sheet-fill/
├── index.yaml              # 别名 → rule_id 注册表
└── rules/
    └── <rule_id>.yaml      # 完整规则（见 rule-schema.md）
```

**index.yaml 示例：**

```yaml
rules:
  - id: weekly-channel-report
    alias: ["渠道周报", "channel-weekly"]
    storage: personal
    rule_file: rules/weekly-channel-report.yaml
    updated: "2026-06-18"
```

用户选「个人记忆」时：写入上述路径；更新 `index.yaml`。**须用户口头确认后再写盘。**

## 3. 团队 Wiki 布局

路径：`kb/okf/semantic/playbooks/lark-sheet-fill-<slug>.md`

用户选「团队 Wiki」时：

1. 列 **目标路径** + **Concept ID**（如 `playbook/lark-sheet-fill-weekly-channel`）
2. 正文含人类可读 SOP + YAML 规则块（与 personal 同 schema）
3. 走 [workflow-v1 ingest B 段](../../th-bi-analytics-assistant/references/workflow-v1.md)
4. 更新 `kb/okf/semantic/playbooks/index.md` 与根 `log.md`
5. 可选：personal 侧只留 `index.yaml` 指针 `storage: kb` + `kb_path`

**Playbook frontmatter 示例：**

```yaml
---
type: Playbook
status: active
lark_sheet_fill_rule_id: weekly-channel-report
related_metrics: []
---
```

## 4. 存储选择话术（建规则末步必问）

> 这条填表规则存哪里？  
> 1. **个人记忆**（仅本机，换机不同步）  
> 2. **团队 Wiki**（OKF Playbook，需 ingest 确认）  
> 3. **两处都要**（Wiki 为权威，memory 留快捷别名）

用户选 3 → 先写 Wiki，memory `index.yaml` 只存 alias 与 `kb_path` 引用。

## 5. 规则变更

- 用户改映射 → 更新对应 YAML / Playbook，**须再次 preview + confirm**
- Wiki 与 memory 双存时冲突 → **Wiki 优先**，memory 标 `sync_from_kb: true`
