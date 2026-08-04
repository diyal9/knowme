## 1. 统一入口

- [x] 1.1 将工作台 rail 的专家、技能、连接器三个按钮替换为单一“能力”按钮
- [x] 1.2 更新 rail 激活态与 toggle 行为，使单一入口默认打开专家 Tab

## 2. 页内 Tab

- [x] 2.1 将 Hub 第三个 Tab 文案明确为“MCP 连接器”，保持 connectors 路由兼容
- [x] 2.2 验证专家、技能、MCP 连接器在同一页面切换并保留深链

## 3. 验证

- [x] 3.1 更新 rail 与 Hub 静态契约测试
- [x] 3.2 运行定向测试、`npm test` 与 `npm run lint`，记录开发自测证据（885/885 PASS，lint PASS）
