## 1. 路径策展与材料体检库

- [x] 1.1 新增 `src/lib/workbench-daemon-surface.js`：常用路径策展、展示文案、材料体检、管线记录投影
- [x] 1.2 新增 `tests/workbench-daemon-surface.test.js` 覆盖 primary≤4、更多路径、软/硬门禁、记录标题

## 2. Daemon 页 UI

- [x] 2.1 更新 `workspace.html` Daemon 区文案（常用路径 / 管线记录）并引入 surface 脚本
- [x] 2.2 重写 `renderDaemonMode`：常用+更多、阶段条、材料体检、折叠团队构成、记录筛选
- [x] 2.3 绑定展开/筛选/开工事件；开工仍走 Launch Drawer
- [x] 2.4 补充 `workbench-console.css` 样式（路径、体检、折叠、筛选）

## 3. 运行页审阅优先

- [x] 3.1 Daemon 运行页：参与专家默认折叠；日志默认折叠可展开
- [x] 3.2 保持门禁/澄清主按钮与产物可见

## 4. 质量

- [x] 4.1 `npm test` 与 `npm run lint` 通过
- [x] 4.2 写入 `evidence/dev-self-test.md`
