# Daemon Web API 调用方参考

| 字段 | 值 |
|------|-----|
| **文档版本** | `1.0.0` |
| **发布时间** | `2026-08-13 00:19:01 +0800` |
| **适用服务** | `tools.workflow_runner.webserver`（PM2 名：`workflow-web`） |
| **默认基址** | `http://127.0.0.1:8010`（本机）；公司入口常为反代 `:3010` |
| **实现源码** | `tools/workflow_runner/webserver/app.py` · `errors.py` |
| **错误码源** | `tools/workflow_runner/webserver/errors.py` 中 `DEFAULT_MESSAGES` |

> 本文面向 **HTTP 调用方**（前端、脚本、其它服务）。运维启停见 `tools/daemon/README.md`；门面说明见同目录 `README.md`。

---

## 1. 约定

### 1.1 鉴权

| 方式 | 用法 |
|------|------|
| Header | `Authorization: Bearer <授权码>` |
| Query | `?token=<授权码>`（少用） |
| Cookie | `wb_token` + 可选 `wb_tenant`（项目组 id） |

- 内网可关鉴权（`web.auth.enabled=false`）→ 访客全功能。
- 开启鉴权后：无 Key 为**体验档**（仅 `demo-*` / `demo-experience`）；完整能力需授权码；多租户时还需项目组。

### 1.2 成功响应

- 多数 JSON 接口直接返回业务对象，或带 `"ok": true`。
- 文本接口（progress / logs）返回 `text/plain`。
- SSE 接口（logs/stream、node stream、chat/query stream）为 `text/event-stream`。

### 1.3 错误响应（统一，自 v1.0.0）

HTTP 状态码保留语义；body **固定**：

```json
{
  "detail": {
    "code": "task_not_found",
    "message": "任务不存在：demo-x"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `detail.code` | string | 稳定机器码（snake_case），**按此分支** |
| `detail.message` | string | 中文用户可读说明（可含动态后缀） |
| `detail.errors` | array? | 可选；校验失败时的明细列表 |

调用方解析建议：

```text
if (!response.ok) {
  const body = await response.json();
  const code = body.detail?.code;
  const message = body.detail?.message || response.statusText;
  // switch (code) { case "auth_required": ... }
}
```

---

## 2. HTTP 状态码

| HTTP | 典型含义 | 常见 `code` |
|------|----------|-------------|
| 400 | 请求无效 / 编码问题 | `bad_request` · `invalid_encoding` · `invalid_json` |
| 401 | 授权码无效 | `unauthorized` |
| 403 | 需登录或无权 | `auth_required` · `task_forbidden` · `tenant_forbidden` · `forbidden` |
| 404 | 资源不存在 | `task_not_found` · `workflow_not_found` · `not_found` · … |
| 409 | 冲突（如 slug 已存在） | `slug_exists` |
| 413 | 上传过大 | `file_too_large` |
| 422 | 参数 / 业务校验失败 | `validation_error` · `demo_slug_required` · `gate_invalid` · … |
| 500 | 服务内部错误 | `internal_error` · `gate_write_failed` · … |

---

## 3. 错误码一览

默认文案来自服务端目录；个别接口会在 `message` 中追加动态信息（如 slug / 异常原因）。

### 3.1 鉴权与租户

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `auth_required` | 需要授权码登录后使用此功能 | 403 |
| `unauthorized` | 授权失败，请重新登录 | 401 |
| `forbidden` | 没有权限执行此操作 | 403 |
| `demo_slug_required` | 体验档任务标识须以 demo- 开头 | 422 |
| `tenant_slug_required` | 任务标识须以项目组前缀开头 | 422 |
| `tenant_forbidden` | 不是你的项目组 | 403 |
| `tenants_disabled` | 未启用项目组功能 | 404 |
| `tenant_not_found` | 未知项目组 | 404 |

### 3.2 任务

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `task_not_found` | 任务不存在 | 404 |
| `task_forbidden` | 不是你的任务 | 403 |
| `slug_exists` | 任务标识已存在 | 409 |
| `slug_invalid` | 任务标识格式错误：须为 kebab-case（`^[a-z][a-z0-9-]*$`） | 422 |
| `ingest_required` | 缺少必要的需求材料 | 422 |
| `handler_required` | 飞书通知（离线）模式须指定处理者 handler_open_id | 422 |
| `mode_invalid` | mode 须为 long 或 pre | 422 |

### 3.3 工作流 / 校验

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `workflow_required` | workflow 字段必填 | 422 |
| `workflow_not_found` | 工作流不存在 | 404 |
| `workflow_or_node_not_found` | 工作流或节点不存在 | 404 |
| `validation_failed` | 参数校验失败 | 422 |
| `validation_error` | 请求参数无效 | 422 |
| `invalid_json` | JSON 无效 | 400 / 422 |
| `invalid_encoding` | 请求编码无效 | 400 |
| `invalid_body` | 请求体须为 JSON 对象 | 422 |

### 3.4 会话 / 流 / 制品

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `chat_session_not_found` | 编排会话不存在 | 404 |
| `query_session_not_found` | 问答会话不存在 | 404 |
| `stream_not_found` | 流不存在 | 404 |
| `stream_session_not_found` | 当前对话没有流式会话 | 404 |
| `artifact_not_found` | 制品不存在 | 404 |
| `not_found` | 资源不存在 | 404 |

### 3.5 Gate / 澄清 / 上传

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `gate_invalid` | 审批参数无效：需要 node 与 decision(approve\|reject\|revise) | 422 |
| `gate_write_failed` | 写入 Gate 决策失败 | 500 |
| `clarify_invalid` | 澄清答复无效：需要 node 与 answer | 422 |
| `clarify_write_failed` | 写入澄清答复失败 | 500 |
| `file_required` | 需要上传文件 | 422 |
| `file_empty` | 文件为空 | 422 |
| `file_too_large` | 文件过大（最大 15MB） | 413 |
| `channel_invalid` | channel 须为 query 或 chat | 422 |
| `action_invalid` | action 须为 reset 或 compress | 422 |
| `text_required` | text 不能为空 | 422 |

### 3.6 通用

| code | 默认 message | 常见 HTTP |
|------|--------------|-----------|
| `bad_request` | 请求无效 | 400 |
| `internal_error` | 服务内部错误 | 500 |

---

## 4. API 目录

下列路径均相对基址（如 `http://127.0.0.1:8010`）。标注 **鉴权** 的接口在开启 auth 时需完整档或符合体验档规则。

### 4.1 元信息 / 健康

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查；含 `ok`、`hostname`、`executor_hostname`、`executor_seen_at` 等 |
| GET | `/api/me` | 当前用户 / 档位 / 租户信息 |
| POST | `/api/auth/login` | Body: `{"key":"..."}`，可选租户；登录换授权态 |
| GET | `/api/tenants` | 项目组列表（`enabled` + `tenants`） |
| POST | `/api/tenants/{tenant_id}/promote` | 推送组分支并开 MR；`?dry_run=true` 可预览 |

### 4.2 工作流 / Pipeline / 策略

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/workflows` | 工作流目录（体验档含 `locked`） |
| GET | `/api/pipelines` | Pipeline 列表（long / pre） |
| GET | `/api/ingest-policy` | 新建任务 ingest 策略；Query: `workflow` / `pipeline` / `mode` |
| POST | `/api/meta-dry-run` | 元任务 dry-run；Body: `workflow` 必填，可选 `node` / `intent` |

### 4.3 任务生命周期

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 当前可见任务列表（含 status / job 摘要） |
| GET | `/api/tasks/check-slug?slug=` | slug 是否可用 |
| POST | `/api/tasks/sync` | 从磁盘扫描并注册任务（需完整档） |
| POST | `/api/tasks` | 创建任务；`multipart/form-data`：`workflow` / `slug` / `intent` / `mode` / `pipeline` / `files` |
| GET | `/api/tasks/{slug}` | 详情：task + job + status + pending gate/clarify + workflow_ui |
| POST | `/api/tasks/{slug}/run` | 入队；Query: `force` / `from_node`；Body 可选 `notify_mode` / `handler_open_id` / `pipeline_summary` |
| POST | `/api/tasks/{slug}/cancel` | 取消 |
| POST | `/api/tasks/{slug}/start-next-stage` | 阶段推进（pipeline `stage_ready`） |
| POST | `/api/tasks/{slug}/gate` | Body: `{node, decision, comment?}`；`decision` ∈ approve\|reject\|revise |
| POST | `/api/tasks/{slug}/clarify` | Body: `{node, answer}` |

### 4.4 任务观测 / 制品 / 变更

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/{slug}/progress` | `progress.md` 纯文本 |
| GET | `/api/tasks/{slug}/logs` | `daemon.log` 全文 |
| GET | `/api/tasks/{slug}/logs/stream` | SSE 实时日志 |
| GET | `/api/tasks/{slug}/events` | 作业事件；Query: `limit` / `after_id` |
| GET | `/api/tasks/{slug}/nodes/{node}/context` | 节点执行上下文 |
| GET | `/api/tasks/{slug}/nodes/{node}/stream` | SSE 节点 stream-json |
| GET | `/api/tasks/{slug}/artifacts` | 制品 / ingest 列表 |
| GET | `/api/tasks/{slug}/artifacts/{path}` | 下载制品 |
| GET | `/api/tasks/{slug}/changes` | 相对 base 的文件变更树 |
| GET | `/api/tasks/{slug}/changes/diff` | 单文件 diff；Query: `path` |
| GET | `/api/tasks/{slug}/workspace/tree` | 工作区树 |
| GET | `/api/tasks/{slug}/workspace/blob` | 工作区文件内容；Query: `path` |

### 4.5 Agents-team / 飞书

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents-team/overview` | Agent 网格 + 活跃任务摘要 |
| GET | `/api/feishu/users/search?q=` | 飞书用户搜索（离线通知处理者） |

### 4.6 对话：编排 Chat / 问答 Query

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat/models` | 可用对话模型 |
| POST | `/api/chat/session` | 创建编排会话（Conductor / `@workflow`） |
| GET | `/api/chat/{sid}` | 会话存在性 |
| POST | `/api/chat/{sid}/message` | 发消息；Body: `{text, ...}` |
| GET | `/api/chat/{sid}/stream/{msg_id}` | 编排回复 SSE |
| POST | `/api/chat/{sid}/context` | 上下文估计 / 切换模型 |
| POST | `/api/chat/{sid}/context/reset` | 重置或压缩上下文；Body: `{action: reset\|compress}` |
| POST | `/api/query/session` | 创建问答会话（Ask / f9-query） |
| GET | `/api/query/{sid}` | 会话存在性 |
| POST | `/api/query/{sid}/message` | 问答消息 |
| GET | `/api/query/{sid}/stream/{msg_id}` | 问答 SSE |
| POST | `/api/composer/{channel}/{sid}/upload` | 上传附件；`channel` ∈ `query`\|`chat`；multipart `file`；≤15MB |

### 4.7 页面（非 JSON API）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 307 → `/task-mode` |
| GET | `/task-mode` | 任务模式 WebUI |
| GET | `/agents-team` | Agent 模式 WebUI |

---

## 5. 调用示例

### 5.1 健康检查

```bash
curl -sS http://127.0.0.1:8010/api/health
# {"ok":true,"hostname":"...","executor_hostname":"...",...}
```

### 5.2 登录

```bash
curl -sS -X POST http://127.0.0.1:8010/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"key":"wb_your_key"}'
```

### 5.3 错误样例

```bash
curl -sS -o /tmp/err.json -w '%{http_code}\n' \
  http://127.0.0.1:8010/api/tasks/no-such-task
# 404
# {"detail":{"code":"task_not_found","message":"任务不存在：no-such-task"}}
```

```bash
# 开启鉴权且无 Token 时同步任务
curl -sS -X POST http://127.0.0.1:8010/api/tasks/sync
# 403
# {"detail":{"code":"auth_required","message":"需要授权码登录后使用此功能"}}
```

---

## 6. 版本与变更

| 版本 | 时间 | 说明 |
|------|------|------|
| **1.0.0** | **2026-08-13 00:19:01 +0800** | 首版调用方文档；统一错误体 `{detail.code, detail.message}`；收录当前全量 `/api/*` 与错误码目录 |

后续变更请递增本文档版本号与发布时间，并与 `errors.py` / `app.py` 保持同步。

---

## 7. 相关文件

| 路径 | 用途 |
|------|------|
| `tools/workflow_runner/webserver/API.md` | **本文**（调用方参考） |
| `tools/workflow_runner/webserver/README.md` | 门面架构 / 启停 / 鉴权配置 |
| `tools/workflow_runner/webserver/errors.py` | 错误码与 handler 实现 |
| `tools/daemon/README.md` | PM2 / systemd 运维 |
| `tools/workflow_runner/tests/test_api_errors.py` | 错误信封回归测试 |
