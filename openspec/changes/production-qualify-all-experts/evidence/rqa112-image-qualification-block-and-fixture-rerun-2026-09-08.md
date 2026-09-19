# RQA112：生图资格阻塞闭环与本地同构夹具复验

日期：2026-09-08

## 真实 Provider 尝试

使用 RQA69 的最小正常案例 `IP01`，读取当前 Cursor MCP 配置后启动隔离 Electron 资格流程。流程在保存 `pango-image-mcp` 的 Cursor Authorization 前被系统安全存储拒绝：

- 未创建专家任务；
- 未保存明文密钥；
- 现在会生成结构化 `configuration_required / enable_secure_storage` 环境阻塞报告，而不是无报告异常退出；
- 该阻塞不计为专家 runtime failure，也不产生生产资格通过证据。

## 本地同构 Provider 复验

启动仓库内置 `qualification-image-fixture-server.js`，通过同一套 Electron、连接器、工具调用、任务生命周期和成果物协议执行 RQA100 生图套件：

| 案例 | 结果 | 关键证据 |
| --- | --- | --- |
| FIXTURE-IP01 正常生成 | `review` | `generate_image` 成功回执、1 个 image deliverable |
| FIXTURE-IP02 工具无图片 | `needs_input` | 无伪造成果物，进入 `artifact_missing` 闭环 |
| FIXTURE-IP03 取消后重试 | `review` | 保留原 Brief，重新产生成功工具回执 |
| FIXTURE-IP04 退回修改 | `review` | 新版本 v2，保留 `previousVersionId` |
| FIXTURE-IP05 验收后重开 | `review` | 新版本 v2，保留上一版关系和再次工具回执 |

结果：5/5 生命周期通过，0 环境阻塞，0 runtime failure；`professionallyQualified=0`，继续等待独立专业断言评审。

## 边界

本地夹具只证明 KnowMe 通用运行时的工具、图片字节、artifact、预览/验收、失败、重试和版本链路闭合。夹具图片是最小 PNG，不证明真实 Provider 的图片质量、视觉符合度、连接器稳定性或商业服务授权。
