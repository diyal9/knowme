# 创建规则：预读 + 结构化提问

无匹配规则时**必须**走完本问卷，**禁止**跳过直接写入。

## Phase A — 预读表格

### A1 解析链接

| URL 模式 | 动作 |
|----------|------|
| `/wiki/` | `lark-cli wiki +node-get --node-token <url>` → `obj_type` + `obj_token` |
| `/sheets/` | token = URL 中 `sht...` |
| `/base/` | token = URL 中 `bascn...`，`type: bitable` |

### A2 读结构

**Sheets（默认）：**

```bash
lark-cli sheets +info --url "<url>"
lark-cli sheets +read --url "<url>" --sheet-id "<sheet_id>" --range "<sheet_id>!1:10"
```

**Bitable（用户明确或多维表链接）：**

```bash
lark-cli base +table-list --base-token "<token>"
lark-cli base +field-list --base-token "<token>" --table-id "<table_id>"
lark-cli base +record-list ... # 可选，读 3～5 条样例
```

### A3 输出「表格画像」（给用户确认）

| 项 | 内容 |
|----|------|
| 文档类型 | sheet / bitable |
| 标题 / 表名 | |
| 表头或字段列表 | 名、疑似类型 |
| 样例行 | 前 3 行（脱敏） |
| 疑似主键 | |
| 不可写列 | 公式、合并、只读 |

---

## Phase B — 结构化提问（按序，可合并成一条消息）

### B1 数据来源

- MCP（TE / 盘古 / 其他）？哪次工具返回？
- 本地 CSV 路径？
- 当轮对话产物（须先抽 JSON，禁止自然语言直写）？

### B2 写入模式

- **追加行**（append，默认）
- **覆盖区域**（overwrite_range：起止 cell）
- **按主键 upsert**（主键列是哪几列？）

### B3 字段映射（逐列）

对每个**可写**目标列：

1. 源字段名？
2. 格式（日期 / 百分比 / 小数位）？
3. 枚举映射（MCP 值 → 表格下拉项）？
4. 是否必填？

### B4 常用别名

- 以后怎么说就能命中这条规则？（写入 `index.yaml` 的 `alias`）

### B5 门禁

- 预览几行？（默认 3）
- 写前是否必须确认？（默认是）
- 是否绑定 OKF Metric 做口径冲突检查？（分析场景可选）

### B6 规则存储（必问）

见 [rule-discovery.md](rule-discovery.md) 存储选择话术。

---

## Phase C — 落盘

1. 生成 `rule_id`（slug）
2. 按 [rule-schema.md](rule-schema.md) 写 YAML
3. 用户选 personal → `<memory_root>/lark-sheet-fill/`
4. 用户选 kb → `kb/okf/semantic/playbooks/lark-sheet-fill-<slug>.md` + ingest
5. 回复：**规则 id、别名、存储位置、下次触发方式**

---

## Phase D — 试填（推荐）

用 1～3 行样例数据走完整 **映射 → preview → confirm → 写入**，验证规则后再结束会话。
