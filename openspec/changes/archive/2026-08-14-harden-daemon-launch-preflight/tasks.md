## 1.Slug 与 Client

- [x] 1.1 实现 `generateTaskSlug`（时间戳）并在 `createAndRun` 自动补全
- [x] 1.2 overview 暴露 `executorReady` / `cursorApiKeyReady`（主进程读 `.nine/.env*`）

## 2. 预检与创建表单

- [x] 2.1 `assessLaunchPreflight` / `assessComposePreflight` + `evaluateIngest` 硬阻断
- [x] 2.2 `submitDaemonCompose` 提交前预检

## 3. Daemon 内容源投影

- [x] 3.1 `resolveDaemonContentRepo`；`projectDaemonTask` 改用安装目录
- [x] 3.2 保留 catalog `path`；按 path/id 加载 workflow JSON
- [x] 3.3 更新 degraded 文案（不再提本地内容源）

## 4. 失败态对齐与测试

- [x] 4.1 `buildWorkbenchTaskBrief` 尊重 failure / terminalKind
- [x] 4.2 单测 + `npm test` / `npm run lint`
