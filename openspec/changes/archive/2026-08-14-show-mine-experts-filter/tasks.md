## 1. 后端：保存入目录 + 列表回填

- [x] 1.1 `expert-save` 成功后调用 `publishSavedExpert` 登记 install store / overlay
- [x] 1.2 `listCapabilities` 合并未登记的 filesystem 专家
- [x] 1.3 集成测试：保存后 capability list 含该专家且 source 为 user 源

## 2. 前端：我的筛选

- [x] 2.1 专家 chips 增加「我的」
- [x] 2.2 筛选逻辑按 local expert source
- [x] 2.3 空态文案 + 保存后切「我的」
- [x] 2.4 静态契约测试更新

## 3. 证据

- [x] 3.1 `npm test`（相关）/ lint 通过（开发自测）
