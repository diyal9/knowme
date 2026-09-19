# RQA26 官方专业对照查看器工作区

状态：R01/H02 旧/新四格全文、原图与 Arendt 原始评分已齐备；初始 blocked 单列。review.html 由官方脚本生成。

非盲、可见配置标签、非随机顺序运行；每题每配置 n=1。比较旧整包 3.2.0 与候选整包 3.4.0，不是纯 Skill 因果对照。平台 review/verificationPassed 不等于专业合格；无稳定性或生产资格结论。

- 使用 skill-creator 原版 eval-viewer/generate_review.py，不自制 HTML 或修改官方模板。
- iteration-1 为计划中的四个有效专业运行；history/initial-blocked 为单列历史，不纳入四格或专业分母。
- outputs/answer.md 逐字符保留同 run 的最终 assistant.text，仅追加文本文件终止 LF；不改正文、换行或措辞。source-binding.json 保留原始消息文本与精确绑定。
- outputs/input-reference.jpg 是输入基图；outputs/generated-image.png 才是本格真实生成图。图片仅复制并核对 SHA256，不缩放或编辑。
- 完整原始 task/session/wire 仍以各 source-binding.json 指向的 evidence 文件和 JSON 路径为准；工作区没有伪造完整 transcript。
- eval_metadata 的断言逐项复制冻结 oracle；不参与评分。Arendt 的 grading.json 原样复制至各运行及 outputs/reviewer-grading-original.json；后者便于完整查看额外 claims/critical/limitations，官方 Grades 面板只显示断言。
- 候选 R01 observer 曾标 old-R01-D1，但实际 assignmentSnapshot.agentVersion/SOP 为 3.4.0；按真实快照标为候选。旧版有效 R01 是修复附件接线后的 D2 运行，不是最初 blocked 尝试。

官方生成命令（UTF-8 模式用于中文；不修改外部 Skill 或模板）：

```powershell
python -X utf8 C:/Users/Administrator/.agents/skills/skill-creator/eval-viewer/generate_review.py "D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace" --skill-name "RQA26 image-producer · 非盲 n=1 · 整包对照（另列 blocked）" --static "D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace/review.html"
```
