# RQA141：curated 能力 manifest 的当前版本优先级

日期：2026-09-09

## 发现

生产审计使用用户数据中的能力目录时，旧 `install-store` 记录会覆盖当前 bundled 包的完整 manifest。这样即使代码包已经补齐路线依赖，已安装专家仍可能继续使用旧契约；本次表现为生图交付物缺少 `pango-image-mcp` 的路线级声明。

## 修正

- `mergeCatalog` 对 `source=curated` 且存在 bundled manifest 的能力，优先使用当前 bundled manifest。
- 用户自定义、外部来源和 linked 能力继续使用其自身持久化 manifest，不被内置包覆盖。
- 不改变安装启停状态、用户名称、来源标识或自定义能力清单。

## 验证

- 新增“旧 curated 安装 manifest 不得覆盖当前 bundled manifest”回归。
- 能力目录与生产审计定向回归：27/27 通过。
- 真实审计复核：`packageReady=true`、`executionReady=false`、`productionReady=false`。
- 当前 `conditionalUnavailableConnectors` 明确包含：
  - `feishu` → 办公协作 4 条路线；
  - `pango-image-mcp` → `image-producer:pango-generate`。
- 当前外部环境仍为 Feishu `auth_required`、Pango `offline`，没有伪造生产回执。

## 结论

能力目录现在不会因为旧安装快照而丢失当前专家路线契约；真实连接器授权、在线状态和路线执行证据仍是生产资格的独立门禁。
