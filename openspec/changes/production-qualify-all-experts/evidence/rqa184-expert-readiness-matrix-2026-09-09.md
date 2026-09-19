# RQA184：保留专家逐项就绪矩阵

日期：2026-09-09

## 目的

将整体 `executionReady=false` 拆解为每个保留专家的包、路线/连接器和专业资格三类状态，避免把沙箱环境问题、缺少真实路线回执和缺少独立评审混成一个错误原因。

## 实现

- 新增 `buildExpertReadinessMatrix`，只消费审计输入，不参与任务执行和资格放行。
- 包状态检查安装、启用、加载和快照降级。
- 路线状态检查路线级真实回执、必需 Skill 和必需连接器。
- 连接器状态直接从当前探针和路线依赖推导，并保留 `auth_required`/`offline` 等环境不可复核状态。
- 专业资格状态继续遵守独立评审者、逐项检查和证据锚点门禁。

## 真实用户数据复核

`node scripts/audit-production-capabilities.js --probe-connectors`：

- `product-manager`：包正常；专业资格未提供。
- `data-analyst`：包正常；专业资格未提供。
- `software-engineer`：包正常；专业资格未提供。
- `image-producer`：包正常；`pango-generate` 未取得回执；Pango 当前探针 `offline`，属于环境不可复核。
- `office-partner`：包正常；4 条 Feishu 路线未取得回执；Feishu 当前探针 `auth_required`，属于环境不可复核。
- `research-analyst`：包正常；公开事实核验和公开网络研究路线未取得回执。

历史运行证据仍单独保留：Feishu 2 次、Pango 1 次成功完成运行工具面。历史证据不提升当前路线或专业资格。

## 验证

- 审计定向测试：`28/28` 通过。
- 当前整体状态：`packageReady=true`、`executionReady=false`、`productionReady=false`。

