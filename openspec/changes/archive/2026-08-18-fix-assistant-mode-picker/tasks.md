# Tasks

## 1. 加号菜单只列内置模式

- [x] 1.1 `renderExpertPop()` 改用 `availableAssistantModes()` 作为数据源，不再合并 `catalogExperts`
- [x] 1.2 保留 `availableExperts()` 供会话标题解析专家显示名使用

对应 spec：`选择我的专家` / `查看模式列表`

## 2. 模式切换不再走专家包路径

- [x] 2.1 `selectExpert()` 对内置模式改为 `createNewAgent({ agentId })`
- [x] 2.2 `startExpertChat()` 收到内置模式 id 时退回模式新建，防止能力中心等入口复现同类错误

对应 spec：`选择我的专家` / `切换模式`、`从能力中心启动专家`

## 3. 回归测试与门禁

- [x] 3.1 更新 `tests/office-assistant-mvp.test.js` 为模式语义断言
- [x] 3.2 `npm run lint` 通过；`tests/office-assistant-mvp.test.js` 全绿，记录 `evidence/dev-self-test.md`
- [x] 3.3 `npm test` 全绿（2026-08-18 check：1587 pass / 0 fail）

对应 spec：全部
