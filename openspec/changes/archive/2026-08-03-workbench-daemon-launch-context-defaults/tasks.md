# Tasks: workbench-daemon-launch-context-defaults

- [x] 1. 新建 `workbench-daemon-launch-context-defaults` change 工件，明确 Daemon 默认上下文与 PRD asset 文件支持范围
- [x] 2. 扩展 `src/lib/workbench-daemon-client.js`，支持读取某个 workflow 的 Daemon 默认上下文，并兼容接口缺失时静默回退
- [x] 3. 更新 `src/main.js` 与 `src/preload.js`，暴露新的 Workbench Daemon 启动上下文 IPC
- [x] 4. 更新 `src/workbench.js`，在启动弹窗中优先展示 Daemon 默认上下文，并保留手动覆盖与本地缓存兜底
- [x] 5. 将 `PRD 相对路径` 字段文案扩展为支持 `PRD / asset 文件`，并确保仍受仓库内相对路径校验
- [x] 6. 更新单测，覆盖默认上下文读取、部分上下文标准化、PRD asset 路径与相关 UI 文案
- [x] 7. 执行 `npm test`、`npm run lint`，补写开发自测证据
