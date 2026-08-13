## 1. 宿主深链

- [x] 1.1 扩展 `openCapabilityHub(tab, opts)`：支持 `expertId`、`surface`；写入 iframe URL
- [x] 1.2 Hub 已打开时用 postMessage `capability-hub-select-expert` 选中专家并更新 surface
- [x] 1.3 Hub 启动读 query；监听 select message；目录加载后 `openDrawer(expertId)`

## 2. 工作台入口

- [x] 2.1 快捷专家卡点击改为 `openCapabilityHub('experts', { expertId, surface: 'workbench', presentation: 'detail' })`
- [x] 2.2 确认「+ 新建任务」仍调用 `openTaskComposer()`
- [x] 2.3 快捷专家卡 UI 对齐专家库 hub-card（头像/标题/副标/描述/徽章/版本）
- [x] 2.4 工作台 agent 列表展示名与专家库目录同源（避免显示 slug）

## 3. 分面底栏与可见性

- [x] 3.1 `renderDrawer()` 按 `state.surface` 组装按钮（capability / workbench）
- [x] 3.2 工作台 surface 底栏仅「开始对话」（无管理动作）
- [x] 3.3 修复 drawer foot 换行与裁切；bump html 中 css/js 缓存版本

## 4. 测试与自测

- [x] 4.1 更新 `tests/capability-hub.test.js` 分面断言
- [x] 4.2 增加/更新 workbench 静态断言：快捷卡样式 + 不直接 `openTaskComposer`
- [x] 4.3 跑 `npm test && npm run lint`
