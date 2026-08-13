## Why

工作台点击已绑定专家时误开「安排专家执行任务」弹窗，用户看不到专家详情与「已在工作台 / 复制为自建」等管理动作；能力界面详情又以「开始对话」为主 CTA，削弱了「添加到工作台」与调优入口。需要按界面分面：工作台侧重开工，能力界面侧重装配与扩展，降低误触并提高专家资产沉淀。

### 目标用户

- 在工作台用快捷专家卡开工的知识工作者
- 在能力 Hub 安装、绑定、复制与调优专家的进阶用户

### 验收标准

- 工作台快捷专家卡打开专家详情（非任务编排弹窗）；「+ 新建任务」仍打开任务编排
- 工作台详情底栏：开始对话、已在工作台（禁用）、精选可复制为自建；三按钮可见不被裁切
- 能力界面详情底栏：主按钮为添加到工作台/已在工作台；精选可复制为自建；可编辑专家可调优；不提供开始对话
- 调优可改系统提示词、Skill、连接器、知识库范围；精选只读须先复制为自建

### 非目标（Non-goals）

- 不改任务创建 / 专家 Session 后端协议
- 不直接改写官方 curated 包内容
- 不重做能力 Hub 整页信息架构

## What Changes

- 工作台快捷专家卡改为深链打开 Capability Hub 专家详情（`surface=workbench`）
- Hub 支持 `expertId` + `surface` 深链与已打开时的 postMessage 选中
- 专家详情底栏按 `surface` 分面渲染动作；能力面去掉「开始对话」
- 修复详情底栏换行/裁切，确保多按钮同屏可见

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `capability-hub`: 专家详情动作按 surface 分面；能力面以工作台绑定与调优为主
- `agent-workbench`: 快捷专家卡打开专家详情，不再直接打开任务编排

## Impact

- `src/workbench.js` — 快捷卡点击入口
- `src/workspace.js` — `openCapabilityHub` 深链参数与 postMessage
- `src/capability-hub.js` / `capability-hub.html` / `capability-hub.css` — surface 状态、底栏、缓存版本
- `src/secondary-dialog.css` — 底栏可见性
- `tests/capability-hub.test.js` 及工作台相关静态断言
