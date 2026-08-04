## Why

专家、技能和连接器目前虽然共用 Capability Hub，却在左侧 rail 占用三个入口，造成导航重复，也让用户误以为它们是三个独立页面。将入口合并后，能力管理会更像一个完整产品模块，用户在页内切换类型即可保持上下文。

## What Changes

- 将左侧 rail 的“专家 / 技能 / 连接器”三个图标合并为一个“能力”图标
- 单一入口打开同一个能力管理页面，默认展示“专家”
- 页面顶部保留并强化“专家 / 技能 / MCP 连接器”三个 Tab，切换时仅更新页内内容
- 保留来自 Agent 空状态等位置的 Tab 深链，可直接打开指定能力类型
- Hub 关闭后继续返回原 Agent 视图，不丢失会话状态

## 目标用户

- 需要统一管理 Agent 专家、执行技能和外部 MCP 能力的知识工作者
- 希望左侧导航简洁、能快速理解能力关系的新用户

## 验收标准

- 左侧 rail 只出现一个“能力”入口，不再分别显示专家、技能、连接器三个入口
- 点击“能力”后打开同一个 Hub 页面，默认激活“专家”Tab
- 页面可通过“专家 / 技能 / MCP 连接器”Tab 切换，卡片、筛选和添加操作随 Tab 正确更新
- 从既有深链进入时仍可激活指定 Tab
- 关闭 Hub 后回到原 Agent 会话，Esc 行为保持不变

## 非目标（Non-goals）

- 不改变专家、技能、连接器的存储、安装和运行时
- 不重做 Hub 卡片、详情抽屉或导入流程
- 不新增 IPC、依赖或独立窗口

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: 左侧 rail 从三个能力入口收敛为一个统一入口
- `capability-hub`: Hub 改由单一入口进入，并以页内 Tab 管理专家、技能和 MCP 连接器

## Impact

- `src/workspace.html`：rail 入口结构
- `src/workspace.js`：单入口打开、激活态与默认 Tab
- `src/capability-hub.html`：Tab 命名与无障碍语义
- `tests/workspace-capability-rail.test.js`、`tests/capability-hub.test.js`：导航与 Tab 契约
- 无主进程、preload、IPC、数据格式或依赖变更
