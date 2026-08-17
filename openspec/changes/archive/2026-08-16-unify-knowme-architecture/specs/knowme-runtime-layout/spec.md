# knowme-runtime-layout

## Purpose

运行时按进程与 feature 分包，禁止上帝文件与双份领域规则。

## Requirements

### Requirement: Composition root stays thin

主进程入口只做 app 命名、userData、加载组合模块，不包含窗口业务实现。

#### Scenario: Main entry does not own note windows

- **WHEN** 开发者打开主进程入口
- **THEN** 其中不包含 `createNoteWindow` 实现，窗口工厂位于 `src/main/` 模块

### Requirement: Feature packages own UI state

每个用户可感知面的状态住在对应 feature 切片，壳只组合。

#### Scenario: AppShell does not define shelf loading

- **WHEN** 工作台货架加载卡片
- **THEN** 加载逻辑来自 workbench feature store，而不是在 `AppShell` 内联 IPC

### Requirement: Single studio model

Studio 校验与草稿变换只有一处导出。

#### Scenario: Domain studio does not wrap globalThis

- **WHEN** 渲染层保存工作流草稿
- **THEN** 调用 `src/domain` 导出的函数，且该模块不通过 `globalThis.WorkbenchStudioModel` 取实现
