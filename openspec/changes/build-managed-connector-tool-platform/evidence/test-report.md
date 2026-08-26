# Test Report

日期：2026-08-22

## Passed

- `npm test`：1743 tests，1692 passed，51 skipped，0 failed。
- `npx vitest run --config vitest.config.ts src/renderer/features/capability-hub/capability-hub.spec.tsx`：19/19 passed。
- `npm run typecheck:renderer`：passed。
- `node scripts/lint.js`：passed。
- `node scripts/check-workbench-css-cascade.js`：passed。
- `node scripts/check-script-scope.js`：passed。
- 连接器与 PSD 聚焦回归：25/25 passed（Tool Runtime、密钥与策略、依赖门禁、legacy SSE、外部导入、ArtBundle 配方）。
- Curated 安装探针：Photoshop stdio 包与 Creator SSE 包均可安装并由 unified connector store 读取。

新增覆盖包括：safeStorage 密钥仓库、公开脱敏、运行时密钥映射、工具 glob 策略、连接器依赖门禁、Workflow 依赖持久化、legacy SSE list/call、外部 MCP 明文凭据转换、能力中心实例配置/测试/授权、PSD 运行配方。

## Live connector verification

- Photoshop 2025（本机 stdio）：在线，服务声明 80 个工具；`photoshop_ping` 成功并返回 `Successfully connected to Photoshop`，`photoshop_get_version` 返回 2025。
- Cocos Creator（`http://127.0.0.1:3103/sse`）：在线，服务声明 16 个工具；`ping` 成功并返回 `pong`；`get_editor_context` 成功读取当前 `ArtBundleDebug` 场景，`dirty=false`。
- 两个 curated 连接器已安装到真实 `%APPDATA%\\KnowMe` 用户配置并启用。
- Creator Access Token 已通过 Electron `safeStorage` 加密；能力中心公开视图和截图仅显示已配置状态。
- 明文扫描通过：`connectors.json`、`connector-secrets.json` 与两个已安装 manifest 均不包含源 token 或 `Authorization`。
- 已有 `th-art-psd-to-artbundle` 工作流已原位升级并持久化 Photoshop / Creator 依赖；Photoshop 工具引用按实机清单修正。
- 能力中心现场截图：[Photoshop](./live-photoshop-connector.png) · [Cocos Creator](./live-cocos-connector.png)。
- 现场命令：`npm run test:live:connectors:configure`；界面核对：`python scripts/live_connector_ui_inspect.py`。

## Project gate exception

`npm run check:quick` 的 lint 阶段通过；全量 renderer 阶段 353 项中 349 项通过、4 项失败。失败位于当前工作区已有并行 UI 改动：

- `src/domain/capability-hub.spec.ts`：固定分类 chip 期望与新增“收藏”chip 不一致。
- `src/renderer/app/surface-css-contract.spec.ts`：两个 workflow CSS 契约不匹配。
- 同一 CSS contract 对 `src/renderer/features/run/console.css` 的小字号规则失败。

这些文件在本 change 开始前已处于修改状态，未为通过门禁而覆盖其设计改动。因此 OpenSpec task 10 与总 gate 保持未完成。
