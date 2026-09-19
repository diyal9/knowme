# RQA15 静态查看器最终生成记录

2026-09-06。按skill-creator官方流程从`method-iteration-1`重建`method-review.html`，未运行新模型评测。实际发现12个run目录，逐一核对transcript为12个不同的真实task ID，不是按目录数推测调用次数。

## 官方生成与局部影响

命令（退出码0）：

```powershell
python -X utf8 C:/Users/Administrator/.agents/skills/skill-creator/eval-viewer/generate_review.py D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/professional-batch4-workspace/method-iteration-1 --skill-name RQA15-professional-package-review --static D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/professional-batch4-workspace/method-review.html
```

未传benchmark，不执行聚合，不等待主线的paired-only-benchmark。当前页面不呈现总体通过率，也不将N/A纳入分母。

修改生成页函数前执行GitNexus `impact(target=renderGrades, direction=upstream, repo=knowme, file_path=.../method-review.html)`：返回Target not found、risk UNKNOWN、impactedCount null；无可用d=1/流程清单，不能解释为零影响。随后读取完整renderGrades及showRun调用上下文。人工确认本次仅在生成页renderGrades内增加17行早返回显示分支：`grading.status === "not_evaluable"`显示中性N/A、五条原断言及各自evidence，标为未评分；不进入默认失败样式、null转0摘要。非N/A逻辑保持原样。使用apply_patch，未修改全局Skill模板、KnowMe源或任何原始评分/案例。

## 实际收录

| Case / 配置 | task ID | 任务状态 | 当前评分文件 |
| --- | --- | --- | --- |
| SE-N01 old | task-mtp24yar-rbgbx | review | 已有 |
| SE-N01 candidate | task-mtp2j2o3-836i0 | review | 已有 |
| SA-N01 old | task-mtp24yox-gr5k1 | failed | 无，页面不补分 |
| SA-N01 candidate | task-mtp2j3g0-uo0z8 | failed | 无，页面不补分 |
| UR-N01 old | task-mtp24yzq-x736d | review | 已有，真实0/5 |
| UR-N01 candidate | task-mtp2j4aq-g00u3 | review | 已有 |
| SE-H02 old | task-mtp2gfw1-60boy | failed | 无，页面不补分 |
| SE-H02 candidate | task-mtp2lh9n-n8ya7 | review | 已有 |
| SA-H02 old | task-mtp2gg85-1vkiq | failed | 无，页面不补分 |
| SA-H02 candidate | task-mtp2li38-xgh19 | failed | 无，页面不补分 |
| UR-H02 old | task-mtp2ggk1-uld13 | review | 已有 |
| UR-H02 candidate | task-mtp2lix5-e7x7b | needs_input | not_evaluable，N/A |

共6份有数值评分、1份显式N/A、5份无grading；这是文件清单，不是生产资格分母或通过率。未把无评分的失败运行转换成0分，也未伪造其专业结论。UR-H02候选kernel DONE不等于任务review，交付物为空的边界仍由原始资料和评分保留。

## 自检结果

- 全部12项内嵌grading与对应原始JSON深比较一致；所有内嵌文本输出与原文件一致（只按官方Python文本读取规则归一CRLF）。
- 修改前后EMBEDDED_DATA整行SHA256均为`d87c9786dea4c57529b19b04d93f46a4071774a97b77fe2f78157124f4b4d355`。
- 本地jsdom执行页面实际脚本，不加载外部资源、不发网络请求：12页showRun导航、进度计数通过；无DOM执行错误。
- UR-H02候选badge精确为N/A，五条断言完整且标未评分，状态为中性破折号，无pass/fail样式及失败叉，摘要无0分/0 passed/0 failed。
- UR-N01旧版仍为0%及5个失败，候选仍1通过4失败；切回N/A后无遗留失败样式。
- 自检最初使用全文`0%`正则会误中冻结断言里的80%/100%，已限定检查评分摘要和badge；未为通过测试改写断言。
- 移除17行本地适配后，整页与当前官方viewer.html替换同一EMBEDDED_DATA的结果精确相等。其余模板代码未改。
- 最终HTML SHA256：`c215927274db45ee5b634bcb540f300a36bbb3026fe4d1d0109b6fb7004db110`。

这验证了本地DOM与数据绑定，不声称做过所有浏览器视觉验收。官方模板保留外部SheetJS引用；本批文本答复的自检未使用该库。再次运行官方生成器会覆盖局部适配，须重做同一适配和自检，不能将未适配的新文件当作本冻结版本。

本次修改文件仅`method-review.html`及本生成记录。未更改原评分、案例、专家包、KnowMe源或全局Skill文件；未执行fullcheck、API、QA配置写入、提交或paired聚合。查看器仅呈现已导出证据，不构成整包因果证明或专家生产认证。
