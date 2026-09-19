# RQA88 — 资格执行器与 Cursor MCP 配置契约

日期：2026-09-08

## 结论

本地修复已完成：真实资格套件可以显式声明从 Cursor MCP 配置读取服务地址，并将指定的 Authorization 头转换为隔离 QA 连接器的 secret slot。生产用户数据不会被写入，凭证不会进入报告或标准输出。

## 变更

- `scripts/expert-qualification-live.js` 新增只读 `mcp.json` 读取、端点预检和 header-to-secret 映射。
- 资格套件只在显式声明 `urlFromCursorServer` 与 `secretsFromCursorHeaders` 时使用该来源；不会扫描或猜测其它 MCP 服务。
- 配置连接器时先移除内部声明字段，再通过 `connectorsSetSecrets` 写入隔离 QA userData。
- RQA69/RQA76 生图套件声明 `pango-skillsrv` 和 `Authorization -> PANGO_ACCESS_TOKEN`。

## 本地证据

- `node --test tests/expert-qualification-live.test.js`：11/11 通过。
- 新增测试使用临时 Cursor 配置和 `fixture.invalid`，只验证解析与脱敏，不发起网络请求。
- `npm run lint`：通过；仅保留既有文件长度 advisory。
- `npm run typecheck:renderer`：通过。
- `git diff --check`：通过；仅有共享工作树既有 CRLF 警告。

## 尚未完成

尚未使用本机真实 Authorization 对远程 `pango.forevernine.net` 发起探测或资格执行。该动作会把本机已配置的外部凭证发送到远程服务，需要用户明确授权；在授权前不能声称生图 Agent 已达到生产资格。
