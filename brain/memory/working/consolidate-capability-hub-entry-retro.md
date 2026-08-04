# consolidate-capability-hub-entry 回顾

- 日期：2026-08-04
- 结论：专家、技能、MCP 连接器已收敛到同一 Capability Hub，通过页内 Tab 切换；rail 仅保留一个能力入口。

## 有效做法

- 复用已有 Hub 与 `?tab=` 深链，只收敛 rail 导航，避免新增页面、IPC 与运行时复杂度。
- 用“rail 表达模块、Tab 表达分类”统一信息架构，减少三个图标造成的页面割裂感。
- 在 QA 前同步修正设置页和 Agent 空态文案，避免旧“技能图标”指引指向已删除入口。
- 使用静态契约、全量测试、Electron 重启与 Playwright 多宽度/快速切换共同验证。

## 经验

- OpenSpec 的 `MODIFIED` 不能静默删除旧场景；行为替换应明确使用 `REMOVED` 旧要求与 `ADDED` 新要求。
- UI 导航收敛后，应全仓检索旧入口名称与用户文案，而不只处理 DOM 和事件绑定。

## 后续

- Hub Tab 在 720px 下可用但略挤，可后续增加 header 响应式布局。
- 可补完整 WAI-ARIA Tab 键盘方向键与 `tabpanel` 关联。
- 是否记忆上次 Hub Tab 由后续用户反馈决定；当前按规格每次从专家开始。
