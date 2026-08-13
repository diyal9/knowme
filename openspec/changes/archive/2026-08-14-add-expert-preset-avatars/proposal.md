## Why

专家卡片与会话首屏目前只用语义 SVG 图标，游戏/办公等多专家并排时辨识偏弱；若上几十张工种插画又会花屏、撑大包体。需要一套克制的 KnowMe 扁平预设头像（少量分类锚点），让专家「看得见人」，又不变成角色图鉴。

### 目标用户

- 在能力 Hub / 工作台并排浏览多个专家，需要快速区分游戏与办公搭档的用户。
- 安装 `game-studio-partner` / `office-partner` 等精选专家后进入对话的用户。

### 验收标准

- 仓库提供有限张 256px 扁平预设头像（游戏含制作/策划/客户端/服务端/UI/特效/测试等 + 办公 3 + 其它 1），总运行时体积明显小于未压缩原图。
- `catalog.json` 声明 domain/role 与匹配关键词；未匹配回退 `other/partner`。
- 会话专家身份区在可解析到预设时显示图片头像，否则保持原有语义图标，不出现 emoji 直出。
- 精选专家 `office-partner` / `game-studio-partner` 能映射到对应预设。

### 非目标（Non-goals）

- 不做工种级 20+ 头像库，不做用户上传/AI 生图流水线。
- 不改助理 FAB 品牌标记（归属 `align-assistant-avatar-with-brand-mark`）。
- 不引入新 npm 依赖；不改 IPC 协议。

## What Changes

- 新增扁平预设头像资源：`src/assets/avatars/{game,office,other}/*.png`（品牌源同步于 `assets/brand-src/avatars/`）。
- 新增 `catalog.json` 与 `agent-identity` 解析：按 avatar 字段 / 语义关键词解析到预设 URL。
- 会话专家身份区优先渲染预设图片，失败回退语义图标。
- 为两个精选专家写入可解析的 avatar 角色键。

## Capabilities

### New Capabilities

- `expert-preset-avatars`: 专家预设头像目录、解析与会话身份区渲染。

### Modified Capabilities

- `expert-runtime`: avatar 字段可使用预设 role 键（如 `office/writer`），仍兼容旧 emoji/短字符串。

## Impact

- `src/lib/agent-identity.js`、`src/workspace-agent.js`、精选 `EXPERT.md`
- 静态资源 `src/assets/avatars/**`
- 测试：`tests/agent-identity.test.js`（或扩展既有 identity 断言）
