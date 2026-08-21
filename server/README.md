# KnowMe 服务端

服务端提供首个发行版所需的授权、套餐、模型目录、模型网关、用量/额度、版本策略、公告和管理后台。云端执行不在本服务范围内，仍由 KnowMe Daemon 负责。

## 本地启动

```powershell
Copy-Item .env.example .env
$env:KNOWME_ADMIN_SEED_PASSWORD = "change-me"
go run ./cmd/admin
```

启动后：

- 管理后台：`http://localhost:8020/admin`
- 健康检查：`GET /healthz`
- 客户端接口：`/v1/activation/*`、`/v1/me`、`/v1/models`、`/v1/quota`、`/v1/chat/completions`

## 首发上线约定

- 激活码只在生成响应中返回明文，数据库只保存 SHA-256 摘要。
- 产品 Token 只返回给激活请求方；撤销或冻结激活后，Token 立即失效。
- 模型供应商 API Key 只从服务端环境变量读取，管理后台不会保存或回显。
- 模型网关记录供应商返回的真实 token 用量；客户端上报接口仅适合作为遥测，不应作为计费依据。
- 当前首发实现使用 SQLite；`KNOWME_DB_DRIVER=postgres` 暂未开放，生产环境应使用持久化磁盘和定期备份。

## 运行检查

```powershell
go test ./...
go vet ./...
```
