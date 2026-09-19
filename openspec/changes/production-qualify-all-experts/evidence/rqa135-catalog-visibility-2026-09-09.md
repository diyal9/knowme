# RQA135：专家目录可见性与新任务可执行性解耦

日期：2026-09-09

## 发现

RQA134 将受限专家从新任务入口隐藏后，发现目录筛选仍复用了“能否创建新任务”的判断。这样会让能力中心完全看不到受限专家，用户无法查看缺失 Skill、连接器授权或能力合同问题，也无法完成修复和诊断。

## 修正

专家目录现在只负责判断条目是否属于公共专家目录；新任务入口继续单独使用 `isExpertAvailableForNewTask` 做严格门禁：

- 能力中心保留受限专家，展示“能力受限”或“当前不可执行”原因；
- 新任务列表不展示明确受限的专家，避免进入后才失败；
- “已合并”仅表示生命周期 `newTasks=false`，不再误用于临时依赖未就绪的专家。

这使“可发现、可诊断”和“可启动、可执行”成为两个独立的通用运行时契约，后续新增专家不需要为目录展示重复适配。

## 验证

```text
npx vitest run src/domain/capability-hub.spec.ts src/domain/workbench-home.spec.ts src/renderer/features/capability-hub/capability-hub.spec.tsx
33 tests / 33 pass / 0 fail

npm run check:quick
Renderer: 86 files / 629 pass / 0 fail
lint: pass
```

此前同一变更链的完整 `npm run check` 已通过：后端 `3473` 通过、`51` 跳过、`0` 失败；Renderer `628` 通过、`0` 失败；lint/typecheck 通过。本次补丁只增加目录状态回归与标签语义修正，没有修改用户 `%APPDATA%/KnowMe` 数据。
