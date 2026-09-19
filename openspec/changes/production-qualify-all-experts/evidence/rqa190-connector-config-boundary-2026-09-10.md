# RQA190：连接器配置与沙箱边界复核

日期：2026-09-10

## 只读配置结果

从真实 KnowMe 用户数据读取连接器结构，不读取或输出密钥值：

- Feishu：`enabled=true`，类型为内置 `feishu`，使用 `lark-cli` 用户授权；20 个允许工具与当前 manifest 一致。
- Pango：`enabled=true`，类型为 MCP，传输为 `streamable-http`；配置了一个密钥槽，允许工具为 `list_paint_models` 和 `generate_image`，对应 3 条保守工具策略。
- Pango 端点仅记录为已配置的 HTTPS origin，不在证据中保存路径、查询参数或密钥。

## 沙箱探测

对 Pango HTTPS origin 发起无业务副作用的 HEAD/TCP 级探测，当前沙箱返回 Windows socket 权限拒绝（`HttpRequestException`），未进入 MCP 握手，也未调用任何工具。

因此当前审计中的 Pango `offline` 至少包含“沙箱网络不可达/不可用”因素，不能归类为连接器配置缺失或授权从未存在。历史运行另有 7 次成功调用和 3 次失败调用，已在 RQA188 单独记录。

## 结论与边界

连接器安装、启用、允许列表和非敏感端点配置均存在；真实可用性仍必须在正常 KnowMe 桌面进程和可访问 Pango 的网络环境中取得当前工具回执。该证据不提升 `executionReady` 或 `productionReady`，也不替代真实生图结果质量评审。
