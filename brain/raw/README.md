# 原始资料（只读）

本目录存放 **不可变** 的原始来源。Agent **只读不写**。

| 子目录 | 用途 |
|--------|------|
| `ingest/` | 待处理的文章、会议记录、用户反馈原文 |
| `references/` | 外部规范与模式引用（如 Karpathy LLM Wiki、OKF SPEC） |

## 规则

- 文件名：`YYYY-MM-DD-<slug>.md` 或保留原始扩展名
- 不修改已入库文件；勘误用新文件 + 在 wiki/knowledge 中标注
- 引用方式：在 OKF concept 的 `# Citations` 中链接到 `/raw/...`

## 参考

- [Karpathy LLM Wiki](references/karpathy-llm-wiki.md)
- [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
