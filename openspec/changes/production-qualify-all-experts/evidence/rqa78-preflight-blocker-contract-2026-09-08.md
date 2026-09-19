# RQA78：通用预检阻塞清单与对话恢复闭环

日期：2026-09-08

## 变更

- `expert-task-runtime` 将预检返回的多个能力、连接器或工具问题保存为结构化 `attention.issues`，同时保留旧的 `kind/action/item/detail` 主投影，兼容历史任务。
- `workbench-task-store` 的任务归一化层持久化这份清单，避免“运行时知道缺什么、刷新后对话看不到”的信息丢失。
- 专家房在阻塞原因超过一项时显示统一的“本次执行还缺少”列表；快捷动作仍由主阻塞类型决定，用户可以前往设置、能力中心或重试，不需要针对某个 Agent 增加分支。
- 展示层保留 `generate_image`、`pango-image-mcp` 等能力 ID 的下划线，避免把调试/配置名称改写成不可检索的文本。

## 验证

- `node -r ./scripts/register-ts.js --test tests/expert-task-runtime.test.js`：37/37 通过。
- `npx vitest run --config vitest.config.ts src/domain/expert-input-need.spec.ts src/renderer/features/expert/expert-task-room.spec.tsx`：93/93 通过。
- `npm run check`：后端 3479 项，3428 通过、51 跳过、0 失败；Renderer 86 文件、612 项通过；lint、CSS cascade、script scope、prompt lint、typecheck 通过。

## 边界

这项变更只修复“预检阻塞如何被准确保存和呈现”，不会把缺少 Provider 或外部工具的环境误报为专家专业能力通过。六个保留专家仍需在真实 Provider 和真实工具面可用后，重跑冻结资格套件并完成独立专业评审。
