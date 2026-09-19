# RQA17 官方静态查看器最终生成记录

2026-09-06：从`verifier-diagnostic-iteration`生成`verifier-diagnostic-review.html`，实际收录2个不同task/run，不是新执行模型或QA。

| Case | 实际run | 本页评分范围 |
| --- | --- | --- |
| SA-H02 | expert_task-mtp2li38-xgh19_mtp4xml0 | 门禁前5644字符候选2/5；非用户交付，实际36字符fallback为专业N/A，任务blocked/needs_input、零artifact |
| UR-H02 | expert_task-mtp2lix5-e7x7b_mtp4zvq8 | 1893字符候选等于实际交付，2/5，专业不合格；平台review不等于专业认证 |

两case的`outputs/00-review-scope.md`均明确标为“评审者生成，非模型原文”，仅作查看器阅读说明，不参与评分。SA作者曝光/非盲、主线非作者复核与UR非作者但非盲的边界保留。两例是运行时诊断观察，不是Skill A/B，不合并交付通过率；旧N/A不覆盖。

## 官方生成

```powershell
python -X utf8 C:/Users/Administrator/.agents/skills/skill-creator/eval-viewer/generate_review.py D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/professional-batch4-workspace/verifier-diagnostic-iteration --skill-name RQA17-verifier-diagnostic-review --static D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/professional-batch4-workspace/verifier-diagnostic-review.html
```

退出码0。未传benchmark，未聚合、未转换N/A。SA的数值grading本来只评价候选，无需修改renderGrades。未手写样式或修改生成页函数；整页与官方viewer.html仅替换EMBEDDED_DATA的结果精确一致，因此本次没有手动符号编辑或全局模板变更。

## 自检通过

- 2run的内嵌grading与源JSON深相等，prompt与metadata一致；每页3份内嵌文本与源文件一致（仅官方文本读取的CRLF归一）。candidate/delivered分别与该run真实捕获字段一致。
- 生成前后12份原有文件（metadata、grading、transcript、review及candidate/delivered）SHA256全部不变。
- jsdom运行真实页面脚本，未启用外部资源加载，不发外部网络请求；两页showRun导航、1/2与2/2计数正常，无DOM错误。
- 两页首项均为评审者说明；SA首项含未交付候选与fallback N/A，UR首项含1893字符实际交付。两页评分均保持40%、2通过3失败，未把SA fallback转换成0分，未生成总体benchmark。
- HTML SHA256：`298577875d2d4006f6e65c76d5ec123961b8cdac2a750215791b93869ec031e8`。这是数据与DOM自检，不声称跨浏览器视觉验收。

## 本次文件范围

1. 新增`verifier-diagnostic-iteration/SA-H02/outputs/00-review-scope.md`。
2. 新增`verifier-diagnostic-iteration/UR-H02/outputs/00-review-scope.md`。
3. 官方重生成`verifier-diagnostic-review.html`。
4. 新增本记录。

未改原始candidate/delivered、metadata、grading、冻结引用、KnowMe源或全局Skill模板。未运行QA、API、生产/测试门禁、提交或模型调用。查看器仅呈现证据，不构成专家生产认证。
