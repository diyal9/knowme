# RQA124：明确意图优先路由与研究专项执行

## 发现

路由选择器按 manifest 顺序返回第一个匹配项，导致通用“已提供材料”条件路线抢在明确的联网研究、知识整理等关键词路线之前，出现“要求联网却不调用网络工具”或“知识整理被路由为普通材料整理”的错误。

## 修正

- `selectExecutionRouteWithMatch` 先在所有满足条件的路线中选择关键词命中项，再选择无关键词的条件兜底项，保留默认路线作为最后回退。
- 增加通用回归，覆盖联网研究、知识整理和材料兜底的优先级，以及否定联网请求不误命中网络路线。

## 验证

- 路由与资格定向回归：`33/33` 通过。
- 本地研究 LLM/Web 夹具 + 正式 Electron 资格入口：
  - `RA09 public-fact-check`：`review`，真实产生搜索与网页读取工具回执；
  - `RA10 public-web-research`：`review`，execution route 已修正为 `public-web-research`；
  - `RA11 knowledge-curation`：`review`，execution route 已修正为 `knowledge-curation`；
  - 生命周期 `3/3`，运行失败 `0`，环境阻塞 `0`。

本证据证明通用路由优先级和研究工具编排闭环，不代表真实联网 Provider、来源内容的独立专业评审或最终生产认证已经完成；`professionallyQualified=0` 保持。
