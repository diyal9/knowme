## 1. Daemon 目录契约

- [x] 1.1 扩展 Daemon 客户端工作流规范化，保留合法 catalog 元数据、兼容缺失字段并过滤内部/废弃/非法目录项
- [x] 1.2 增加客户端单元测试，覆盖 primary、advanced、旧响应兼容、目录排序字段与关闭式过滤

## 2. 工作台目录体验

- [x] 2.1 将工作流目录改为按 catalog.order 稳定排序，并让数量、搜索和打开行为共用用户可见集合
- [x] 2.2 默认直接展示 primary 工作流，将 advanced 工作流放入带数量的默认折叠区域
- [x] 2.3 更新目录样式和模板回归测试，确保高级流程可展开、搜索和启动

## 3. 验证与证据

- [x] 3.1 运行聚焦测试、完整 npm test、lint 与 OpenSpec 严格校验
- [x] 3.2 重启 KnowMe，验证当前 Daemon 目录不再平铺全部流程，并保存开发自测证据

## 4. 移出仓库注入的试验流程

- [x] 4.1 将 `game-dev-delivery` 的本仓库注册元数据改为 `deprecated`，并补充 bootstrap 回归测试
- [x] 4.2 幂等同步到本机 Daemon，确认“手机游戏研发交付”不再出现在 `/api/workflows`
- [x] 4.3 复跑聚焦测试、lint 与 OpenSpec 严格校验，并更新开发自测证据
