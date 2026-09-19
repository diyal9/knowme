# RQA77：最终六个保留专家隔离实测记录

日期：2026-09-08

## 目的

在不触碰日常 `%APPDATA%\KnowMe` 数据的前提下，使用 `expert-qualification-live.js` 对最终保留的六个专家逐套执行当前冻结资格题，确认当前运行时是否能进入真实模型、工具与成果物阶段。

## 运行范围

| 专家 | 套件 | 用例数 | 实际结果 |
|---|---|---:|---|
| 产品经理 | RQA62 | 6 | 6/6 `needs_input / configuration_required` |
| 生图执行专家 | RQA69 | 5 | 5/5 `needs_input / environment-blocked` |
| 数据分析师 | RQA72 | 6 | 6/6 `needs_input / configuration_required` |
| 办公协作专家 | RQA73 | 4 | 4/4 `needs_input / configuration_required` |
| 研究分析师 | RQA74 | 4 | 4/4 `needs_input / environment-blocked` |
| 软件开发工程师 | RQA75 | 1 | 1/1 `needs_input / configuration_required` |
| 生图执行专家补充正常题 | RQA76 | 1 | 1/1 `needs_input / environment-blocked` |

合计 27 个隔离真实任务：

- 27/27 在任务创建后由运行时进入 `needs_input`。
- 27/27 被统一识别为环境阻塞：其中 Provider 未配置为 `configuration_required`，必需能力未暴露为 `capability_unavailable`。
- 27/27 的生命周期评估标记为 `blocked`，不再显示为生命周期失败；真实运行失败仍单独计入 `runtimeFailed`。
- 0 个进入模型生成、工具调用或成果物生成阶段。
- 0 个被记录为运行时 `failed`，没有伪造成功成果。
- 0 个具备可供独立专业评审的真实正文或图片交付，因此不能计入专家生产资格。

## 结论

当前环境的统一阻塞是“运行所需的 Provider 或能力面不可用”，不是某个专家单独缺少 Skill。生图专家的“工具成功但没有图片回执”用例也尚未触发，因为执行在环境能力门禁处停止；不能把它误判成工具失败闭环已验证。AgentEvals 对这类结果统一标记为 `blocked`，不再误标为 `failed`。

对应原始报告：

- `evidence/rqa62-live-rerun-2026-09-08.json`
- `evidence/rqa69-live-rerun-2026-09-08.json`
- `evidence/rqa72-live-rerun-2026-09-08.json`
- `evidence/rqa73-live-rerun-2026-09-08.json`
- `evidence/rqa74-live-rerun-2026-09-08.json`
- `evidence/rqa75-live-rerun-2026-09-08.json`
- `evidence/rqa76-live-rerun-2026-09-08.json`

下一步仍需在配置可用 Provider 后重跑同一套件，才可以验证专业输出、工具权限、图片 artifact、修改/重试/重开及独立语义评审。
