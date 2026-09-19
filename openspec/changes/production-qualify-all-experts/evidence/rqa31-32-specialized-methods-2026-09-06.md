# RQA31–32 — 办公与专业写作专家方法分化

## 本轮结论

本轮完成的是五位专家的**候选能力修复**，不是生产资格认证。`office-partner`、`data-report-editor`、`longform-editor`、`meeting-scribe`、`presentation-writer` 不再只依赖泛化润色方法；它们现在拥有各自可装配、可版本化、默认无外部权限的专业核心 Skill。通用运行时增加声明式路由条件，不按专家 ID 写分支。

没有执行真实模型、飞书读取、用户安装升级、付费调用、外部写入或完整 UI 生命周期验收；五位专家均仍待冻结案例实测，全部 24 专家目标继续 ACTIVE。

## RQA31：办公协作专家

- `office-partner` 从 2.0.0 单调升级并统一为 2.1.0，新增必需核心 `office-collaboration-method` 1.0.0；`writing-polish` 降为可选。
- 交付合同合并为一个 `办公协作结果`。发送前检查仅在用户要求发送、发布或交付前检查时内联出现，不再强制制造第二个成果物。
- 用户已经提供可读材料时，选择本地材料路线，不调用飞书；直接起草邮件、周报、同步稿等走无连接器路线；只有明确要求“从飞书/读取飞书”等才启用飞书路线。
- `selectExecutionRoute` 增加通用 `when.hasReadableMaterials` 与 `when.noneKeywords`，适用于任意声明同类契约的专家，不含 `office-partner` 特判。
- `tests/rqa31-office-partner-routing.test.js` 7 项通过；相关办公与路由组合 61 项通过。

## RQA32：四类专业写作方法

- 数据报告：`data-report-method`，要求指标台账、百分点与相对变化区分、显著性边界、图文一致、结论范围和行动建议。
- 长文编辑：`longform-editing-method`，要求完整正文、主张—证据链、引语保真、事实/结构/表达三层编辑和修订连续性。
- 会议纪要：`meeting-evidence-method`，区分提议、决议、分歧和待确认项，保留时间位置与行动字段；提供转写时本地整理，明确要求飞书妙记时才要求 `feishu.meeting_candidates`、`feishu.meeting_read`。
- 决策演示：`decision-presentation-method`，围绕决策目标、备选项、逐页任务、证据、讲述时长、ROI 缺口和附录组织内容，不把文本大纲声称为 PPTX 文件。
- 四位专家的 E/C/L/catalog 统一为 2.1.0，泛化 `writing-polish` 均降为可选，两个文本输出合同合并为一个可读回答。
- `tests/rqa32-specialized-writing-experts.test.js` 17 项通过，包括核心 L1 完整装配及会议双路由工具边界。

## 冻结评测与未完成项

按 `skill-creator` 的方法先冻结、后执行，已新增：

- `skill-evals/office-collaboration-method-workspace/evals.json`：4 个正常、缺事实、飞书读取和修订连续性案例。
- `skill-evals/specialized-writing-methods-workspace/evals.json`：8 个数据、长文、会议、演示正常/反例案例。

这些只是评测输入与客观断言，尚未运行，不能记录通过分数。下一步必须用实际模型输出比较专业硬伤、SOP、缺失输入处理和修改闭环；通过后还需安装态、重开恢复及视觉验收。

## 工程验证

- 定向 RQA32：17/17 通过。
- 最终 `npm run check`：exit 0；后端 3393 通过、51 跳过、0 失败；renderer 86 文件 606 项通过；lint 与 renderer typecheck 通过。
- lint 仅保留既有三处文件行数 advisory，无专家提示词错误。

上述工程结果仅证明包、路由、装配和回归契约成立，不证明模型输出达到专家标准。
