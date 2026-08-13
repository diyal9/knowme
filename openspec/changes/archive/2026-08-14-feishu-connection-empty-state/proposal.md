## Why

启用 `game-studio` 能力包后，助手空状态被「策划/研发/测试/制作」四张游戏角色卡占据，并显示「游戏工作室」kicker，掩盖了通用模式下已验证的飞书连接入口（文档、会议、聊天）。用户期望空状态以连接为主旋律，并自然衔接到工作流 intake / ingest，而不是先暴露垂直角色分工。

目标用户：日常用飞书协作、需要把资料快速整理成可启动 Daemon 工作流材料的知识工作者。

商业化与体验价值：把「连上飞书 → 查资料/会议/聊天 → 梳理需求 intake → 进入工作台流程」做成首屏主路径，降低垂直包启用后的认知跳跃，强化 KnowMe 作为连接型工作伙伴的产品定位。

## What Changes

- 去掉空状态「游戏工作室」kicker；更新 hero / sub 文案为连接导向。
- 空状态四卡改为飞书连接快捷入口：查文档、会议总结、相关聊天、需求梳理（工作流 intake）。
- 原游戏角色场景（策划/研发/测试/制作）保留路由与技能映射，但默认不进入空状态展示。
- 需求梳理入口绑定飞书连接器与需求技能，emptyPrompt 引导整理可启动工作流的 intake。
- Renderer 在 kicker 为空时不渲染 kicker 行。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `game-studio-scenes`: 空状态场景从角色卡改为飞书连接 + 工作流 intake 入口；游戏角色场景仍可路由但不默认展示。
- `capability-pack`: 空状态 UI 元数据允许省略 kicker；分组渲染在无 kicker 时不展示该行。

## Impact

- `src/packs/game-studio/pack.json`、`scenes.json`
- `src/lib/capability-pack-runtime.js`（`listEmptyStateGroups`）
- `src/workspace-agent.js`（空状态 HTML）
- `tests/game-studio-scenes.test.js` 及相关 pack 测试
- 不改 Daemon API、不改左侧 Rail / 工作台流程目录

验收标准：
- 空状态无「游戏工作室」字样。
- 四卡为：查文档/知识库、会议总结、相关聊天、需求梳理（工作流）。
- 点击前三卡走飞书连接快捷处理；点击需求梳理产出可进入工作流的 intake 结构。
- 原 `game-design` / `game-dev` 等关键词路由与 legacy 映射仍可用。

非目标（Non-goals）：
- 不卸载 game-studio 能力包，不删除游戏技能。
- 不改工作台工作流目录 UI（Rail）。
- 不新增飞书 API；复用现有连接器与快捷 prompt。
