## 1. Runtime / IPC

- [x] 1.1 `expert-runtime.deleteExpert`：安全路径校验后删除专家目录
- [x] 1.2 `deleteExpertForHub`：拒精选；卸载 store/overlay；清工作台绑定
- [x] 1.3 注册 `expert-delete` 与 preload `expert.delete` / `expertDelete`

## 2. 编辑弹窗 UI

- [x] 2.1 底栏增加「删除专家」（仅自建 tune）
- [x] 2.2 危险确认后删除、关弹窗、刷新列表
- [x] 2.3 删除后清理 Agent Profiles

## 3. 验证

- [x] 3.1 更新静态契约与 runtime 单测
- [x] 3.2 `npm test`（相关用例）+ `npm run lint`
