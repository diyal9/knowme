## Context

运行视图已是接管式三段（确认输入 → 执行中 → 产物）。问题在呈现层：

1. `syncRunTopbar` 已写工作流名 + 产出；`renderRunInputStage` 又把同内容写进卡片 `h2` / `hint`。
2. 字段标签模板 `${required ? 必填 : ''} ${type}` 把 schema 的 `text` 直接暴露给用户。
3. 后端标签保留 `Local Team Runtime` 等内部名；参与 Agent 在确认输入缺省未披露（spec 要求有）。

## Goals / Non-Goals

**Goals**

- 单源标题：顶栏 = 工作流身份；卡片 = 阶段指引与表单。
- 用户可读标签：必填徽章、无原始 type 噪声。
- 只读元信息：专家 chips + 系统选定执行方式（产品中文）。
- 视觉与货架 token 对齐：圆角、线色、焦点环、主按钮。

**Non-Goals**

- 不新增后端选择 UI。
- 不改 `collectRunInputs` / `confirmRunInputs` 数据形状。
- 不重做执行中状态机 UI 逻辑，仅统一外壳。

## Decisions

1. **卡片标题改为阶段指引**  
   例：「填写本次信息」；hint 写一句操作说明，不再重复「产出：…」。产出只在顶栏。

2. **字段 type 隐藏**  
   默认全部不渲染 type 小字；布尔/枚举由控件形态表达。

3. **后端产品文案**  
   `Local Team Runtime` → `本机专家团队`；`管线服务` 保留；前缀改为「执行方式：…（系统自动选择）」类只读句。

4. **参与专家**  
   有 `workflow.nodes` 时列出去重后的中文角色名；无节点则隐藏专家区，不伪造。

5. **样式集中**  
   运行表面样式继续在 `workbench-shelf.css`，与货架同文件，避免散落到 layout。

## Risks / Trade-offs

- 去掉卡片内工作流名后，窄屏隐藏 stepper 时用户更依赖顶栏标题（已有）。
- 无 nodes 的包暂不显示专家 chip（诚实缺省，避免假数据）。

## Migration

无数据迁移。
