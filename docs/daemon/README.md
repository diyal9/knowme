# Daemon / 管线服务协议（KnowMe 副本）

本目录是 **workflow-web（Daemon）HTTP 调用方协议** 在 KnowMe 仓库内的同步副本，供客户端实现与联调对照。

| 项 | 值 |
|----|-----|
| 上游源文件 | `D:\workflows\workbench\tools\workflow_runner\webserver\API.md`（相对上游仓：`tools/workflow_runner/webserver/API.md`） |
| 同步副本 | [API.md](./API.md) |
| 当前同步版本 | `1.0.0`（发布时间 `2026-08-13 00:19:01 +0800`） |
| 默认基址 | `http://127.0.0.1:8010` |
| KnowMe 客户端 | `src/lib/workbench-daemon-client.js` · `src/lib/workbench-auth.js` · `src/lib/workbench-daemon-errors.js` |

上游变更后：覆盖复制 `API.md`，更新本表版本号，并核对本 README 的端点清单。

### 同步校验

```bash
npm run daemon:docs-check
# 或
node scripts/check-daemon-docs-sync.js --json
```

- 默认校验本地 `API.md` 与本 README 的版本字段自洽。
- 若本机存在上游文件（表中路径，或环境变量 `DAEMON_API_UPSTREAM`），则额外比对版本/内容哈希。
- 上游缺失时为 **advisory**（退出码 0）。需要硬失败时设 `DAEMON_DOCS_STRICT=1`。
- `harness doctor` 会以 advisory 汇总该检查。

## 错误信封（调用方必读）

失败响应 body 固定为：

```json
{
  "detail": {
    "code": "task_not_found",
    "message": "任务不存在：demo-x"
  }
}
```

KnowMe **按 `detail.code` 分支**；`unauthorized` / `auth_required` 归一为客户端 `auth_required` 以触发设置页授权引导。`task_forbidden` / `tenant_forbidden` / `forbidden` **不**改写为登录提示。

## KnowMe 已使用的 API 子集

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | 在线与执行器心跳 |
| POST | `/api/auth/login` | 授权码验证 |
| GET | `/api/workflows` | 工作流目录 |
| GET | `/api/tasks` | 任务列表 |
| POST | `/api/tasks` | 创建任务（multipart） |
| GET | `/api/tasks/{slug}` | 任务详情 |
| POST | `/api/tasks/{slug}/run` | 入队运行 |
| GET | `/api/tasks/{slug}/artifacts` | 制品列表 |
| GET | `/api/tasks/{slug}/progress` | 进度文本 |
| GET | `/api/tasks/{slug}/logs` | 日志文本（首屏/降级） |
| GET | `/api/tasks/{slug}/logs/stream` | SSE 实时日志增量 |
| GET | `/api/tasks/{slug}/events` | 作业事件 |
| GET | `/api/tasks/{slug}/changes` | 变更树 |
| GET | `/api/tasks/{slug}/workspace/tree` | 工作区树 |
| GET | `/api/tasks/{slug}/workspace/blob` | 工作区文件 |
| POST | `/api/tasks/{slug}/gate` | Gate 决策 |
| POST | `/api/tasks/{slug}/clarify` | 澄清答复 |
| GET | `/api/agents-team/overview` | Agent 专家目录 |

## 客户端扩展（上游 API.md 未收录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/workflows/{id}/launch-context` | KnowMe 拉取启动默认上下文；缺失时客户端按 `unsupported` 非阻塞降级 |

上游若正式收录该端点，应从本表「扩展」移入主清单。

## 上游有、KnowMe 暂未封装

例如：`/api/me`、`/api/tenants`、`/api/pipelines`、`/api/ingest-policy`、`/api/tasks/sync`、`cancel`、`start-next-stage`、chat/query SSE、制品下载路径等。需要时按 [API.md](./API.md) 增量接入，并复用 `workbench-daemon-errors` 解析。
