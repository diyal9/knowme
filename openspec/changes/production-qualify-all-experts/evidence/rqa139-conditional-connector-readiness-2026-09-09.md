# RQA139：条件路线连接器就绪诊断

日期：2026-09-09

## 发现

办公协作专家的四条 Feishu 路线声明了 `connectorId: feishu`，但生产审计此前只检查路线 Skill 是否安装。这样会把“连接器记录存在且 enabled”误解为“连接器已授权且可在线执行”。

## 修正

- 条件路线契约现在保留 `requiredConnectorIds`。
- 审计计算 `requiredConnectorsReady`，并输出 `conditionalUnavailableConnectors`。
- `--probe-connectors` 只探测保留专家必需连接器和条件路线连接器；不会触发无关的本地 MCP。
- 单个连接器探针失败会转成 `unhealthyConnectors` 和结构化状态，不会让整份审计崩溃。
- 条件连接器缺失或不可用会阻止 `executionReady` / `productionReady`，但不影响静态 `packageReady`。
- 交付物声明也支持 `connectorId` / `requiredConnectorIds`，保持通用契约，不为某个专家写特判。
- 后续复核发现生图交付物只继承了专家顶层的 Pango 依赖，未在 `pango-generate` 路线显式声明；已补为 `requiredConnectorIds=["pango-image-mcp"]`，使生图路线与 Feishu 路线使用同一层级的依赖诊断。

## 真实环境复核

- Feishu 用户授权状态：`auth_required`，当前没有可用 user identity。
- Pango MCP：`offline`，工具数为 0。
- 生产审计：`unhealthyConnectors=[feishu,pango-image-mcp]`；办公四条路线的 `conditionalUnavailableConnectors` 指向 `feishu`，生图 `pango-generate` 路线指向 `pango-image-mcp`。
- 因此没有执行真实外部写入或伪造成功回执。

## 验证

- 条件连接器审计定向回归：20/20 通过（累计连接器审计相关回归 29/29）。
- 全量后端：3530 tests，3479 passed，51 skipped，0 failed。
- Renderer：86 files，630 tests passed。
- lint、架构检查、脚本范围检查、prompt lint、typecheck 通过。

## 结论

平台现在能区分“已安装”“已启用”“已授权/在线”和“已取得路线执行回执”。真实服务仍需在授权和在线环境中复跑，当前 `executionReady=false`、`productionReady=false` 是正确结果。
