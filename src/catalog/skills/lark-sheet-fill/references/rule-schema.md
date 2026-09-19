# 填表规则 Schema（YAML）

`rule_id` 建议 kebab-case。Sheets 与 Bitable 共用顶层结构，`target.type` 分流。

## 完整示例（Sheets · append）

```yaml
meta:
  name: "渠道周报"
  description: "TE 渠道留存结果追加到运营周报"
  write_mode: append          # append | overwrite_range | upsert
  storage: personal           # personal | kb | both

target:
  type: sheet                 # sheet | bitable
  url: "https://xxx.feishu.cn/sheets/shtcnXXX"
  spreadsheet_token: "shtcnXXX"   # 从 URL 或 +info 取得
  sheet_id: "0abc"                # +info 返回
  header_row: 1
  data_start_row: 2

# upsert 时必填（sheet：用 +find 定位行；bitable：按字段查 record）
upsert_key: ["日期", "渠道"]

columns:
  - target: "日期"              # 飞书表头名（与 header_row 一致）
    source: "date"              # 源 JSON 键名或 CSV 列名
    transform: "date:YYYY-MM-DD"
    required: true
  - target: "渠道"
    source: "channel_name"
    enum_map:
      toutiao: "头条"
  - target: "D7留存"
    source: "retention_d7"
    transform: "percent:2"
    skip_if_formula: true       # 目标列为公式时跳过

gates:
  preview_rows: 3
  user_confirm: true
  conflict_check:               # 可选；th-BI 分析场景
    metrics: []                 # OKF 相对路径，如 /semantic/metrics/d7_retention.md

memory_hint:
  kind: analysis_workflow       # habit | business_theory | analysis_workflow
```

## Bitable 扩展字段

```yaml
target:
  type: bitable
  url: "https://xxx.feishu.cn/base/bascnXXX"
  base_token: "bascnXXX"
  table_id: "tblXXX"            # +table-list 取得
  # 无 header_row；字段名用 +field-list 的 name
```

写入时用 `lark-base +record-create` / `+record-update`；字段类型见 lark-base field 文档。

## 字段说明

| 路径 | 必填 | 说明 |
|------|------|------|
| `meta.write_mode` | ✅ | 见 [write-modes.md](write-modes.md) |
| `target.type` | ✅ | `sheet` 默认；`bitable` 走 lark-base |
| `columns[].target` | ✅ | 目标列/字段名 |
| `columns[].source` | ✅ | 源字段；JSONPath 简写 `$` 前缀可选 |
| `columns[].transform` | | `date:YYYY-MM-DD`、`percent:N`、`number:N` |
| `columns[].enum_map` | | 源值 → 表格下拉/显示值 |
| `gates.preview_rows` | 推荐 | 默认 3 |
| `gates.user_confirm` | 推荐 | 默认 true |

## 禁止写入列

预读表格时标记：
- 公式列（Sheets 含 `=` 或只读）
- 合并单元格区域的数据列
- Bitable 公式 / lookup 只读字段

写入前从 `columns` 剔除或设 `skip: true`。
