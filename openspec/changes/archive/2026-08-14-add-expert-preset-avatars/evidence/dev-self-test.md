# Dev self-test — add-expert-preset-avatars

Date: 2026-08-11

## Assets

- 13× PNG @ 256px under `src/assets/avatars/{game,office,other}/`
- Game adds: `client` / `server` / `planner` / `ui` / `vfx`
- Gender mix: male for client/server/engineer/designer/vfx/qa/writer/partner; female kept for producer/planner/ui/collaborator/knowledge
- Pack size ≈ 1.1 MB total
- `catalog.json` fallback = `other/partner`

## Commands

```bash
node --test tests/agent-identity.test.js
npm test
npm run lint
```

## Results

- agent-identity: 4/4 pass
- full suite: 1623/1623 pass
- lint ok / script-scope ok

## Manual spot-check (recommended)

1. `npm start` → 打开绑定 `office-partner` / `game-studio-partner` 的专家会话
2. 首屏身份区应显示预设照片头像（非 emoji）
3. 未知专家回退 `other/partner`
4. 能力 Hub → 专家卡片应显示预设图；新建专家时改名称「客户端工程师」应自动选中 `game/client`
5. 手动点选头像后保存，列表与会话身份区一致
6. 工作台 Agent 详情弹层、任务创建专家摘要、Graph 启动节点显示预设图
7. 会话 Tab / 模式菜单 / 历史列表显示小尺寸预设图（内置 writing→writer、coding→engineer、steward→knowledge）
