# 数据适配（MCP / CSV → rows[]）

统一中间格式：

```json
{
  "rows": [
    { "date": "2026-06-18", "channel_name": "toutiao", "retention_d7": 0.321 }
  ],
  "meta": { "source": "te_mcp", "tool": "query_adhoc", "ts": "..." }
}
```

## TE MCP

1. 从 `query_adhoc` / builder 返回中找 tabular 部分（`data` / `rows` / 列名+行数组）
2. 列名与规则 `columns[].source` 对齐；不对齐时在映射前 rename
3. 记录 `meta.tool` 供 memory episodic 使用

## 盘古 / 其他 MCP

- JSON 数组 → 直接 `rows`
- 嵌套对象 → 按用户确认的 JSONPath 展平（如 `$.result.list[]`）

## CSV

1. 读表头 + 全表（或用户指定行范围）
2. 表头 trim；编码 UTF-8，失败试 GBK
3. 空行跳过
4. 列名与 `source` 匹配；多余列忽略，缺列报 **required** 错误

## 当轮对话产物

1. Agent 从分析结论 **抽取** 结构化 JSON（表格化）
2. **禁止**把 Markdown 段落直接写入单元格
3. 数值须带来源说明（TE 查数 / 用户口述）；用户口述标 `confidence: user_stated`

## Transform 约定

| transform | 行为 |
|-----------|------|
| `date:YYYY-MM-DD` | 解析 ISO/常见格式 → Sheets 日期或字符串（按列类型） |
| `percent:N` | 0.321 → 32.10% 或小数 N 位（预读列格式决定） |
| `number:N` | 固定 N 位小数 |

Sheets 原生日期格：需单元格已为日期格式；否则写 `YYYY-MM-DD` 字符串。

## 映射后校验

- `required: true` 缺值 → 中止，列出行号与列名
- `enum_map` 缺键 → 列出未映射值，问用户补映射或跳过行
