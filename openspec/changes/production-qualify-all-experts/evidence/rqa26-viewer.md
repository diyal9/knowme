# RQA26 官方 eval-viewer 编排记录

工作区：D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace

已完整读取 skill-creator/SKILL.md、references/schemas.md，并运行官方 generate_review.py --help，核对其 outputs/eval_metadata/grading 发现与静态导出接口。

R01 有效旧版：task-mtpluo03-l436a / expert_task-mtpluo03-l436a_mtplurqe，3.2.0。候选：task-mtpllbgi-sw9ph / expert_task-mtpllbgi-sw9ph_mtpllfe9，3.4.0。候选原 observer 标签 old-R01-D1 不作为包版本依据，已保留纠正说明。

初始 task-mtpkut6w-6cluf 单列 history/initial-blocked；无专业正文/图，N/A，非旧版有效格。没有改写 attention 为 answer。

非盲、可见配置标签、非随机顺序运行；每题每配置 n=1。比较旧整包 3.2.0 与候选整包 3.4.0，不是纯 Skill 因果对照。平台 review/verificationPassed 不等于专业合格；无稳定性或生产资格结论。

R01/H02 四格全文、真实图片和 Arendt 评分已齐备；官方静态查看器已生成，见下方最终核验。未编造缺失格、评分、耗时或成本，未修改 Arendt grading 原件或冻结 oracle。

## 最终交接：已生成并校验

查看器：[review.html](D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace/review.html)。官方脚本静态输出，未自制 HTML、修改模板或外部 Skill。

生成命令（exit 0）：

```powershell
python -B -X utf8 C:/Users/Administrator/.agents/skills/skill-creator/eval-viewer/generate_review.py D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace --skill-name 'RQA26 image-producer · 非盲 n=1 · 整包对照（另列 blocked）' --static D:/aispace/knowme/openspec/changes/production-qualify-all-experts/skill-evals/rqa26-image-methods-workspace/review.html
```

官方 generate_review.py SHA256：44d97a35be977331b13b04932927b3beb285862a173f0f15dd052d4f31de5c76；官方 viewer.html 模板 SHA256：46abd4e19e482b4aeebea24b135c2d88fb122a63346dbeab7fcecd83828a826d。

- 5 attempts：R01/H02 旧/新四格，另列最初 blocked。blocked 无 answer、无图片、无评分，不作为 0/9 或第五个专业样本。
- 原样接入 Arendt 四份 grading：旧 R01/H02 均 8/9，候选均 9/9。36 条断言未改；评分原件与两处副本逐字节相等。全文 claims、critical、限制说明在各格 reviewer-grading-original.json 中可见，未只展示局部得分。
- 四格 answer.md 均来自同 run session.messages 最终 assistant.text，逐字符相等，仅有文件末尾 LF；未使用 task.resultSummary。四份 source-binding 保留来源文件 SHA256、task/session/run、原文和图元数据。
- 四张生成图和四份同一输入基图复制前/后 SHA256 一致；静态 HTML 中八个 image data_uri 解码后与副本逐字节相等。未编辑图片。详见工作区 image-copy-verification.json。
- provider-requests.json 原样选取对应 wire 索引的 tools/call 观察，包括完整最终图像 prompt 和参考图字节 hash；不声称为未截断的全网络记录。候选 R01 的旧 observer label 保留并纠正，版本以真实快照为准。
- 官方模板带有外部字体与 SheetJS 引用；本任务没有联网加载或修改它们。本轮仅文本/图片，材料本体均内嵌。未做浏览器视觉验收，未称为完全无外部引用的离线页面。
- 静态内嵌数据校验 exit 0：精确核对运行数、四个 task/run、原文、36 条断言、两个 8/9 与两个 9/9、评分对象/副本字节、八张嵌入图片字节、blocked 无评分；未生成混合工程/专业 benchmark。

校验摘要：

```json
{
  "attempts": 5,
  "gradedRuns": 4,
  "assertions": 36,
  "generatedImages": 4,
  "inputImageCopies": 4,
  "blocked": "separate, no answer/image/score",
  "gradeCopiesByteExact": true,
  "answersExactPlusTerminalLF": true,
  "imageEmbedsByteExact": true,
  "results": [
    {
      "caseId": "R26-IP-R01",
      "configuration": "old_skill",
      "runId": "expert_task-mtpluo03-l436a_mtplurqe",
      "score": "8/9",
      "answerChars": 253,
      "gradingSha256": "aa5f69a42e34f75f99c37af94e350fb63e28764173e45bdc263d602d1267ecfb"
    },
    {
      "caseId": "R26-IP-R01",
      "configuration": "with_skill",
      "runId": "expert_task-mtpllbgi-sw9ph_mtpllfe9",
      "score": "9/9",
      "answerChars": 263,
      "gradingSha256": "f5fad7e5c9d5575b0f58dbdd803713d63f779a94f8ccc8fa4f6b0e8324dcc1e9"
    },
    {
      "caseId": "R26-IP-H02",
      "configuration": "old_skill",
      "runId": "expert_task-mtpmaqln-tf3ct_mtpmaui5",
      "score": "8/9",
      "answerChars": 336,
      "gradingSha256": "25fe2093fc4dc7f3a15a2391896af8d28cfed18f3eacaeb062483370b4f60ef3"
    },
    {
      "caseId": "R26-IP-H02",
      "configuration": "with_skill",
      "runId": "expert_task-mtpmgiwr-ceqif_mtpmgmts",
      "score": "9/9",
      "answerChars": 252,
      "gradingSha256": "efdcf1de0ebc858c42f8e97b4648e927c0577779086575eade9f1b50b68ae90c"
    }
  ],
  "viewerSha256": "9285f866fd6ac65c001e92605af30af1e4693dabbc99762fb5b46a23435f8330",
  "viewerBytes": 9129507
}
```

边界：这是可见标签的非盲、非随机顺序整包比较，每题每配置 n=1，非纯 Skill 因果对照或资格认证。主线报告 check51355 exit0（backend3335 pass/51 skip、renderer606 pass）仅是工程指标，本任务未重跑或计入专业分。只读 rqa26-ui-verification.json 记录 H02 313.59375×420、contain、重开后一个输入；其 scope 明确 paidRevisionSent=false、accepted=false，不等于实际付费 revision/用户验收，本任务未重复 UI 操作。

编排过程说明：一次本地暂存路径状态未就绪导致六个自建 H02 文本短暂落入错误暂存目录，已准确移回授权工作区并仅清理自建空目录，未遗留额外文件或改动生产/他人文件。首次自写内嵌图片检查误用了字段名，核对官方 data_uri schema 后重跑通过；未修改查看器、评分或生产文件来通过检查。
