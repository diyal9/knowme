# Test Report

日期：2026-09-05

## 结果

| 检查 | 结果 |
|---|---|
| `npm run check` | 通过 |
| Node 全量测试 | 2008 项；1957 通过，51 跳过，0 失败 |
| Renderer 全量测试 | 80 个文件；494/494 通过 |
| `npm run lint` | 通过；22 个专家 Prompt 0 error / 0 warning |
| `npm run typecheck:renderer` | 通过 |
| `npm run typecheck:lib` | 通过 |

补充回归确认：成果类型在底层运行记录中按安全的声明值原样持久化，`answer`、`document`、`image`、`table`、`checklist`、`code` 和命名空间扩展类型均不会再被错误降级为 `text`。

交互回归确认：用户通过计划卡片选择“确认计划并执行”或“直接开始”后，选择内容会立即显示为用户对话气泡，并以 `user_confirmation` 材料随任务持久化；重新进入任务仍可恢复该确认内容。手动在输入框键入确认的原有路径保持通过。
| `npm run test:agent-eval` | hard-offline 10/10，通过率 100% |
| 全专家矩阵 | 22/22 专家正常交付与无效 AI 配置异常路径通过 |
| 运行态视觉探针 | 通过；实图加载、单输入框、无嵌套修改框、完整大图、0 控制台错误 |
| Story gate | 通过；npm-test、npm-lint、test-renderer、typecheck-renderer、typecheck-lib 全部 pass |

## 专项覆盖

- 任意专家按能力契约获得 Provider adapter，不依赖专家 ID。
- 必需工具未调用、工具失败、无 Artifact、Artifact 类型错误、数量不足均阻断完成并保留任务背景。
- 文本、文档、单图、多图和动图走统一 Artifact 预览契约。
- 重新打开任务恢复目标、消息、任务编号、状态和全部成果引用。
- 单成果修改直接使用主输入框；多成果修改要求选择具体成果。
- 模型最终说明失败时，已验证 Artifact 仍保留为可审阅成果。

## 可追溯证据

- `expert-room-runtime.json`
- `expert-room-runtime.png`
- `expert-room-runtime-dialog.png`

## 外部依赖说明

自动化没有调用收费或需要用户凭据的真实图像供应商。供应商连通性不影响本报告对平台契约、运行时编排和 UI 渲染的结论；真实供应商验收必须在已配置账号下单独执行，不能用模拟结果冒充。

## 工作区说明

GitNexus 全仓 change detection 已执行。由于工作区包含 279 个文件、504 个符号的既有混合变更，其 CRITICAL 汇总等级不能隔离为本 change 的等级；本报告只对上文列出的专家模块专项范围作通过结论，不宣称无关改动已被本次审查接管。
