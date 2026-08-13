## Why

工作台与设置页大量直出英文 `Daemon`，普通用户无法理解其含义，与已有「团队管线 / 管线记录」语义场不一致，增加连接、开工与排障成本。

## What Changes

- 将所有**用户可见**文案中的 `Daemon` 统一改为 **管线服务**（含 Tab 标题、状态、toast、空状态、错误恢复、设置提示等）。
- 内部标识符、IPC、协议字段、文件名、CSS class、函数名保持 `daemon` 不变（非 BREAKING）。
- 更新依赖这些可见文案的测试断言。

### 目标用户

- 通过工作台连接执行后端、启动团队管线的业务与工程同学。
- 在设置页配置 Workbench 授权与部署的管理员。

### 验收标准

- 工作台 Tab / 管理面板 / 状态条 / toast / 空状态不再出现裸 `Daemon` 英文词作为产品名。
- 同等语义处统一为「管线服务」（如「管线服务在线」「连接管线服务」）。
- `npm test` 相关断言通过；协议与 IPC 契约不变。

### 非目标（Non-goals）

- 不重命名代码标识符、IPC channel、API path、CSS class。
- 不改 Daemon HTTP 协议或执行语义。
- 不改 OpenSpec 历史归档文案与开发向注释的全量清洗（可选后续）。

### 商业化与体验价值

降低「看不懂 Daemon」的流失，让「团队管线」产品叙事一致，连接与排障文案可被普通用户理解。

## Capabilities

### New Capabilities

- （无；本变更为纯文案统一，`skip_specs: true`）

### Modified Capabilities

- （无；不改变行为需求，仅展示名）

## Impact

- `src/workspace.html`、`src/workbench.js`、`src/settings.html` 等用户可见文案
- `src/lib/*` 中面向用户的 error / label / toast 字符串
- `tests/workbench-templates.test.js` 等文案断言
