## 1. 资源与清单

- [x] 1.1 生成并压缩预设 PNG（现 13 张：游戏 9 + 办公 3 + 其它 1）至 `assets/brand-src/avatars/` 与 `src/assets/avatars/`
- [x] 1.2 写入 `catalog.json`（含 fallback `other/partner`）
- [x] 1.3 扩展游戏侧：client / server / planner / ui / vfx

## 2. 身份解析

- [x] 2.1 扩展 `src/lib/agent-identity.js`：`identityAvatarSrc` / 预设匹配
- [x] 2.2 单元测试覆盖显式键、旧短字符串、未知值回退

## 3. 渲染与精选专家

- [x] 3.1 `workspace-agent.js` 身份区优先渲染预设 `<img>`
- [x] 3.2 更新 `office-partner` / `game-studio-partner` 的 avatar 键
- [x] 3.3 补充 CSS：身份区圆形/圆角图片裁切

## 4. Hub 默认应用与创建选择

- [x] 4.1 Hub 卡片/精选/抽屉对专家渲染预设头像
- [x] 4.2 创建/调优专家：头像选择器 + 按名称/职责/Skill 自动匹配
- [x] 4.3 保存写入 `avatar` 角色键（不再默认 emoji）

## 5. 门禁

- [x] 5.1 `npm test` / `npm run lint` 通过
- [x] 5.2 写 `evidence/dev-self-test.md`

## 6. 全站 Agent 露面补齐

- [x] 6.1 工作台 Agent 详情弹层 / 任务创建专家摘要 / Graph 启动节点使用预设图
- [x] 6.2 会话 Tab、模式菜单、历史列表使用预设图（小尺寸裁切）
