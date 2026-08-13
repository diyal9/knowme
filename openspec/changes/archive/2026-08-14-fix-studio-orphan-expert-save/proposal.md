## Why

编排工作流保存 /「保存后离开」时，若节点仍绑定已删除的自建专家（如 `qa-copy-n1ip1s`），会弹出晦涩的 `无法解析 member agentPackageId`，用户无法理解也无法顺利改绑。删除专家只清工作模式绑定、不清个人工作流引用，导致幽灵专家残留。

### 目标用户

- 在工作台编排个人工作流、并管理自建专家的用户

### 验收标准

- 保存失败时提示「执行专家已删除或不存在，请重新选择」，并带上专家 id
- 画布 / 执行专家下拉对失效绑定显示「已失效」，可改选现存专家后成功保存
- 删除自建专家后，个人工作流中对应 `agentPackageId` / `agentRefs` 被清空（节点结构保留）
- 既有残留引用打开编辑时不会静默卡住；可改绑后保存离开

### 非目标（Non-goals）

- 不自动用同名新专家替换旧 id
- 不删除含失效专家的工作流本身
- 不改 Team Runtime fail-closed：未解析专家仍禁止试跑 / 提交校验通过

## What Changes

- 编排保存 / 离开保存路径：将 `unresolved_member` / `unresolved_node_agent` 译为可读中文提示
- 专家节点：失效 `agentPackageId` 在下拉与卡片上标记「已失效」
- 专家删除：扩展 `onExpertUninstalled`，同步清理个人工作流包中的专家引用

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `agent-composition-studio`：失效专家可见可改绑；保存错误可读
- `workflow-package`：支持按专家 id 清理个人包引用
- `capability-hub`：删除自建专家时清理工作流引用

## Impact

- `src/workbench.js`、`src/lib/workbench-studio-canvas.js`、`src/lib/agent-package-runtime.js`
- `src/lib/workflow-package-store.js`、`src/main.js`（`onExpertUninstalled`）
- 单测：`tests/` 下编排 / 工作流包清理
