# QA Plan: split-capability-hub-service-by-domain

## Smoke Scope

- [ ] `require('../src/lib/capability-hub-service')` 导出符号与拆分前一致
- [ ] 能力 Hub 列表 / 收藏 / 安装预检 IPC 通道仍可注册（单元测试覆盖）
- [ ] 专家 save/delete/backfill 逻辑回归（capability-integration）
- [ ] Session knowledge 投影与 patch 校验（session-knowledge-scope）
- [ ] Skill task catalog 合并（skill-task-catalog）
- [ ] `capability-hub-service.ts` lint 无 WARN（≤1200 行）

## 自动化

```bash
node -r ./scripts/register-ts.js --test tests/capability-hub.test.js
node -r ./scripts/register-ts.js --test tests/capability-integration.test.js
node -r ./scripts/register-ts.js --test tests/session-knowledge-scope.test.js
node -r ./scripts/register-ts.js --test tests/skill-task-catalog.test.js
npm test
npm run lint
```

## 手动（可选）

- 启动应用，打开能力 Hub 页，确认列表渲染无控制台报错
