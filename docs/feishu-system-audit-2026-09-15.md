# 飞书 CLI / 连接器核验记录

核验日期：2026-09-15。目标任务：`task-mtv8irda-9t1st`。

## 结论

当前有效配置是一套 `@larksuite/cli@1.0.77` 和一个启用的 `feishu` 内置连接器。未发现重复的有效飞书连接器或 PATH 中互相覆盖的 CLI 安装，不需要卸载重装或重新授权。

截图对应的是 2026-09-10 08:55 UTC 的历史运行。该运行没有调用飞书：`toolCalls=0`，`toolSurface.available=0`。任务持久化的交付契约只要求 `action-extraction`，`requiredTools` 和 `requiredConnectorIds` 都为空。模型随后自行判断缺少账户访问能力，这段回复仍被记为 completed，并送入任务验收。

当前仓库已有相关路由修复。用原始任务和冻结快照重放，得到 `related-chats`、`feishu.related_chats` 和 `feishu` 连接器；使用实际工具装载器投影后，工具白名单包含且允许 `feishu.related_chats`。本轮没有新增产品源代码修复。

## 实测证据

| 检查 | 结果 |
| --- | --- |
| PATH CLI | npm 的 `.ps1`、`.cmd`、无后缀入口均指向同一套安装 |
| 用户授权 | 正常系统权限下服务端验证通过；可自动刷新 |
| 沙箱差异 | 受限诊断环境报告 keychain token 缺失，正常系统环境可读取；不能据此要求用户重新登录 |
| KnowMe 状态 API | `online`，`userReady=true`，`agentVisible=true` |
| KnowMe 只读适配器 | `feishu.list_chats` 成功，CLI 返回 `ok=true`、`identity=user` |
| 相关聊天工作流 | `ok=true`，16 个会话，当日 @我结果 0 条 |
| 读取覆盖范围 | `partial=true`，会话列表截断；未读取全部消息正文；没有可靠未读计数 |
| 原任务工具投影 | v1 模式，投影 `feishu.related_chats`，允许调用 |
| 相关回归检查 | 85 项通过，0 失败 |

回归文件：`feishu-expert-chain.test.js`、`feishu-auth.test.js`、`feishu-cli.test.js`、`feishu-tool-surface-routing.test.js`、`rqa31-office-partner-routing.test.js`。

## 清理处置

- 保留唯一有效 CLI 和现有系统凭据；真实只读调用已验证自动刷新路径。
- `connectors.json`、受管 `manifest.json`、`capability.manifest.json` 对飞书类型和工具清单一致，是当前兼容存储及权限描述，不是三个并行飞书连接器。
- 历史 `.bak` 文件不参与当前连接器加载，保留用于回滚。
- 未删除用户授权、未修改其他连接器、未覆盖现有工作区修改。
- 原任务历史结果仍保留。本轮完成了原任务路由、实际工具投影及真实读取验证，没有重新执行模型生成或把旧成果改为成功。

## 使用边界

“相关消息与聊天”目前支持相关会话与 @我 消息检索，不能等同于完整未读收件箱，也不能把本次 0 条 @我 结果解释为所有聊天均无待办。后续若同类失败重现，应检查失败运行的工具投影、执行契约及真实 CLI 回执，不应只根据模型的自然语言解释判断授权失效。
