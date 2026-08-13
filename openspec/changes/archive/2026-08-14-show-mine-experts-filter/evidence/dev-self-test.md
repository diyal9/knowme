# Dev self-test — show-mine-experts-filter

Date: 2026-08-11

## Automated

- `node --test tests/capability-hub.test.js tests/capability-integration.test.js` → 28/28 pass
- `npm run lint` → ok

## Manual (for producer)

1. 打开专家库 → 按场景浏览末尾可见「我的」
2. 新建专家保存 → 跳到「我的」且卡片可见
3. 「我的」不含办公/游戏精选伙伴
