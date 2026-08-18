## 1. Daemon 专家契约

- [x] 1.1 规范化 agents-team overview 专家 DTO、排序和安全字段
- [x] 1.2 将专家请求接入 Daemon overview，并让失败独立降级

## 2. Workbench 来源切换

- [x] 2.1 在线时优先返回 Daemon 专家，离线或接口不可用时回退本地仓库
- [x] 2.2 保持现有刷新按钮重新加载专家、数量和详情

## 3. 验证

- [x] 3.1 增加 Daemon 专家规范化、在线优先与本地回退测试
- [x] 3.2 运行聚焦测试、lint、OpenSpec strict validate
- [x] 3.3 重启 KnowMe 并验证当前 Daemon 的 10 位专家已加载
