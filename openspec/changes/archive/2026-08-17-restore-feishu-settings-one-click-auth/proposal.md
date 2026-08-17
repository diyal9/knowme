## Why

设置页飞书连接器在 React 重构时丢失了状态机与 CTA 语义：已连接仍常显「补充权限」，文案过于粗糙。对普通用户，飞书接入应是清晰的一键授权，而不是反复点「补充权限」。

## What Changes

- 把飞书卡片的状态判定 / 主按钮文案 / 是否可点封装为纯函数 view-model（与 UI 组件解耦）
- 恢复与重构前对齐的就绪语义：未就绪主 CTA 为「一键授权」；文档知识库已可用且权限齐全时主按钮为禁用的「已连接」
- 权限确认面板展示分类清单（已授权 / 本次申请），避免盲点授权
- 通用连接器空列表文案改回「暂无其他连接器。」；高级设置折叠控件补回可识别的展开提示

## Capabilities

### New Capabilities

- `settings-feishu-connector`: 设置页飞书连接卡片的一键授权体验与状态呈现

### Modified Capabilities

（无；连接器鉴权 IPC / scope 计划仍由 `connector-feishu-auth` 与 connector-sdk 提供）

## 目标用户

需要把飞书接到 KnowMe、但不想理解 scope / 白名单细节的办公用户。

## 验收标准

- 未连接时主按钮为「一键授权」，点击后先确认权限再打开授权页
- 已连接且权限齐全时主按钮为「已连接」且不可点
- 文档/知识库未齐时状态文案说明缺口，主按钮仍为「一键授权」
- 高级白名单仍折叠在开发者选项；普通路径不强制展开
- 单元测试覆盖 view-model 关键状态与设置页一键授权流程

## 非目标（Non-goals）

- 不改飞书 CLI / OAuth / token 存储策略
- 不重做公司 MCP 或 Workbench 授权区
- 不把飞书草稿审批搬回设置页

## Impact

- `src/renderer/features/settings/settings-connector-status.ts`（或拆出的 feishu card 模块）
- `SettingsFeishuSection.tsx` / `SettingsConnectorsPanel.tsx` / `settings.css`
- `settings.spec.tsx` 与新增纯函数测试
