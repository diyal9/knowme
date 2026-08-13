## Why

编排顶栏大标题写死「编排工作流」，真实工作流名挤在副行，无法一眼识别当前在编什么，也不能在顶栏直接改名。

### 目标用户

在 Studio 编排并维护个人工作流的用户。

### 商业化与体验价值

顶栏身份更清晰，改名路径更短，减少「这是哪条流程」的迷失感。

## What Changes

- 顶栏主标题展示当前工作流名称，点击可内联改名并写入草稿（标 dirty）。
- 副行改为「编排工作流 · N 节点 · 已保存/未保存」（不再重复工作流名）。
- 改名与 Inspector 流程名字段保持同步。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-studio-head-nav`：主标题 MUST 为可编辑工作流名；副行 MUST 以「编排工作流」作为场景标签。

## Impact

- `src/workspace.html`：顶栏标题结构
- `src/workbench.js`：渲染与改名
- `src/workbench-shelf.css`：可编辑标题样式
- `tests/`：结构断言

## 验收标准

1. Studio 顶栏主标题为当前工作流名（缺省如「我的专家协作」）。
2. 点击主标题可改名；Enter/失焦提交，Esc 取消。
3. 副行以「编排工作流」开头，后接节点数与保存态。
4. 改名后草稿 dirty，Inspector 名称字段同步；保存路径不回归。
5. `npm test` + `npm run lint` 通过。

## 非目标（Non-goals）

- 不改画布/组件库/保存协议。
- 不在顶栏做完整设置表单。
