## Why

自建专家只能「编辑 / 保存」，删除入口缺失；用户想从编辑弹窗直接清理误建或临时专家，否则只能绕开 Hub 手动删文件，体验断裂。

### 目标用户

- 在专家库「我的」中管理自建专家的用户

### 验收标准

- 编辑**自建**专家（source 为 `local` / `custom`）时，编辑弹窗底栏出现「删除专家」
- 新建 / 复制为自建 / 精选只读弹窗**不**出现删除
- 确认后永久移除本地专家包、能力目录登记与工作台绑定；成功后关闭弹窗并刷新列表
- 精选 / pack / official 专家即使被恶意调用 API 也无法删除

### 非目标（Non-goals）

- 不提供技能 / 连接器卸载的同构改造
- 不删除历史对话 Session 消息
- 不改精选专家只读策略

## What Changes

- 专家编辑弹窗底栏为自建编辑态增加危险操作「删除专家」
- 新增 `expert-delete` IPC：校验来源后删除包目录、install store、overlay，并触发工作台绑定清理
- 删除成功后清理该专家的 Agent Profile

## Capabilities

### Modified Capabilities

- `capability-hub`: 自建专家编辑弹窗可删除

## Impact

- `src/capability-hub.{html,js,css}`、`src/lib/expert-runtime.js`、`src/lib/capability-hub-service.js`、`src/preload.js`
- 扩展 `tests/capability-hub.test.js`、`tests/expert-runtime.test.js`
