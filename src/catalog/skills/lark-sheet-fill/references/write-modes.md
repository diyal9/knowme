# 写入模式与飞书 CLI

执行前 **Read lark-shared**；Sheets 用 **lark-sheets**，Bitable 用 **lark-base**。

## write_mode 决策

| 模式 | 适用 | Sheets | Bitable |
|------|------|--------|---------|
| `append` | 日志型、周报追加 | `sheets +append` | `base +record-create`（批量） |
| `overwrite_range` | 固定区域刷新 | `sheets +write --range` | 一般不推荐；按 record 更新 |
| `upsert` | 同主键更新 | `+find` / `+read` 定位行 → `+write` 或删后 append | `+record-list` 筛主键 → `+record-update` 或 create |

默认：**append**。

## Sheets 写入

### 读表头（映射列序）

```bash
lark-cli sheets +read --url "<url>" --sheet-id "<id>" --range "<id>!<header_row>:<header_row>"
```

按表头顺序组装 `--values` 二维数组（每行一数组，列序与表头一致；未映射列填空字符串或跳过列需与用户确认）。

### 追加

```bash
lark-cli sheets +append --url "<url>" --sheet-id "<id>" \
  --values '[[ "2026-06-18", "头条", 0.321 ]]'
```

下拉列用 `{"type":"multipleValue","values":["选项"]}`；公式列不写入。

### 覆盖

```bash
lark-cli sheets +write --url "<url>" --sheet-id "<id>" --range "<id>!A2:C10" \
  --values '[[...],[...]]'
```

### Upsert（Sheets）

1. `+read` 主键列 + 行号范围
2. 匹配 `upsert_key` 组合
3. 命中 → `+write` 该行 range；未命中 → `+append`

## Bitable 写入（次要）

1. `+field-list` 确认字段名与类型
2. **create**：`+record-create --records '[{"fields":{...}}]'`
3. **update**：`+record-update` 带 `record_id`
4. 附件 / 人员 / 关联字段 → 先读 lark-base field 对应 reference

## 单元格类型

遵循 lark-sheets **单元格数据类型**表：公式、下拉、@人 必须用对象格式。

## 失败处理

| 错误 | 处理 |
|------|------|
| 下拉值不在选项 | `+get-dropdown`，提示用户补 enum_map |
| 权限 / scope | 读 lark-shared 权限章节 |
| Wrong Filter Value | 与填表无关；勿动筛选除非用户要求 |

## 写后回执

向用户报告：

- 目标 URL / 表名
- `write_mode`、写入行数
- 使用的 `rule_id` 与存储位置
- 失败行（如有）
