# 开发自测报告

- 日期：2026-08-07
- Change：`use-bell-for-assistant-fab`
- 定向测试：PASS（`node --test tests/workspace-agent.test.js`，33/33）
- `npm test`：PASS（1287/1287）
- `npm run lint`：PASS（lint ok / script-scope ok）
- OpenSpec 严格校验：PASS
- IDE lint：PASS（无新增诊断）
- Electron UI 冒烟：PASS（铃铛 19×19 px、红点右上定位 2px/2px、品牌头像保留）
- 运行时错误：0 page error / 0 console error

## 覆盖结果

- 悬浮助理触发按钮使用 24×24 视口的单色描边铃铛，光学显示尺寸 19 px。
- 面板头像继续使用 KnowMe 节点品牌标记。
- 单一恢复状态红点已从按钮左侧移至铃铛右上沿；透明点击热区、弹层语义、纵向位置持久化与 presence 状态契约保持不变。

## 截图

- `screenshots/assistant-bell-detail.png`
- `screenshots/assistant-bell-workspace.png`
