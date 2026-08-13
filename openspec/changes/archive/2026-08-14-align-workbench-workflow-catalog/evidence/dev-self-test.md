# 开发自测

日期：2026-08-04

## 结果

- Daemon 当前目录返回 14 个用户可见工作流：`primary` 6 个、`advanced` 8 个。
- 本仓库注入的 `game-dev-delivery` 已在注册源和本机 Daemon 索引中标记为 `deprecated`；`/api/workflows` 不再返回“手机游戏研发交付”，历史任务与内部执行文件保留。
- KnowMe 客户端保留 `catalog.visibility/category/order`，并过滤 `internal`、`deprecated` 与非法目录项。
- 工作流页默认只平铺 6 个常用工作流；高级工作流默认折叠并显示“8 个”，展开后可见 8 张卡片。
- Electron 已通过 `npm start` 启动；首次实例运行约 2 分钟后被并行桌面测试实例替换，GPU、网络与渲染子进程以 `-1` 退出。随后再次执行 `npm start`，请求已正常交给正在运行的测试实例并以 0 退出；当前 Electron 主进程与渲染进程仍在运行。
- 使用真实 `workspace.html` / `workbench.js` 和当前 Daemon 目录形状完成静态渲染复核，控制台 error 为 0。

## 自动化检查

- `node --test tests/workbench-bootstrap.test.js tests/workbench-daemon-client.test.js tests/workbench-templates.test.js`
  - 52/52 通过。
- `npm test`
  - 967/967 通过。
- `npm run lint`
  - `lint ok`，`script-scope ok`。
- `npx openspec validate align-workbench-workflow-catalog --strict`
  - 通过。

## 界面证据

- 默认折叠态：`screenshots/workflow-catalog-collapsed.png`
- 高级工作流展开态：`screenshots/workflow-catalog-expanded.png`

说明：截图是浏览器静态预览证据，不代替 Electron 真机启动检查；真机启动状态已单独通过进程与启动日志确认。首次实例的 `-1` 退出发生在并行测试接管窗口期间，不作为目录逻辑错误处理。
