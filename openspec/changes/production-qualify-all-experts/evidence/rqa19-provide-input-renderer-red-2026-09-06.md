# RQA19 provideInput：独立 renderer 红测冻结

2026-09-06。仅新增测试和本报告，不改生产/已有测试，不调用真实任务、模型、API、QA或用户数据。沿用 gitnexus-debugging：query 为 FTS 降级空结果，provideInput context 返回历史行号、lower-bound；当前源码为判断依据。没有修改生产符号，也没有声称完成生产变更 impact。

## 测试与实跑

文件：`src/renderer/features/expert/rqa19-provide-input.spec.tsx`。

命令：`node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/renderer/features/expert/rqa19-provide-input.spec.tsx`

当前源真实结果：**7项，2通过、5失败，exit 1**。不是源码字符串断言，也不是模拟组件：真实 AppShell → ExpertTaskRoom → AgentComposer，使用真实 Zustand store，只 mock preload API。按既有 spec 模式初始化附件，等待唯一输入框、store/render正文和发送ready后提交；受控 Promise 测在途返回，不使用真实sleep。

| 条件 | 当前实测 |
|---|---|
| needs_input / running，API 返回 ok:false 且 task 存在 | 2红，原正文被清空。附件保留和错误回显也列为断言，但本次首先失败于正文丢失，不能把后续未执行断言称已验证。 |
| API失败无task / Promise rejection | 2绿，正文及附件保留。 |
| needs_input / running 成功，当前正文+文本附件+图片附件 | 2红，payload.materials 为 undefined。正文/action/queue与单次调用检查已通过；成功后清理已提交附件的断言等待生产修复后继续验证。 |
| 旧请求在途时用户输入新正文、添加新附件，随后旧请求成功 | 1红，较新的未发送正文被清空。测试还要求只消费本次已提交附件，不删除新增附件。 |

附件契约沿真实 runtime 的 `materials` 参数，不接受只放在未消费的顶层 `attachments`。允许原始 name/text 或规范化 title/content，不规定实现私有ID；图片要求 kind/mimeType/dataUrl 保真。

## 绑定与冻结 hash

| 对象 | SHA256 |
|---|---|
| 新7项 spec | `5DA36438BF463D18E706B79CB85394F9D8F18EA016D0DAAA41753BCF40E04EE0` |
| ExpertTaskRoom.tsx（红测源） | `B846A5995BAA0BC9663031F6BA1B57329F2650A3BAF87E990380156637D9B62A` |
| 原 expert-task-room.spec.tsx（未改） | `BFAE3564F5E121017A2C21837106837B7937586995F2D57B3C65227180AA01CA` |

## 有界风险和最小修复建议

`ExpertTaskRoom.tsx:411` 起 provideInput 只判断 result.task；后端 `expert-task-runtime.ts:995` 起可合法返回 `{ok:false,task,error}`，因此被误当成功。UI同一函数只传 note/action/queue，不传当前附件，并在 await 后无条件清空 composer。

建议捕获提交瞬间正文与附件，按正式 materials payload 一起送达；只有明确 ok:true 且有task时消费本次提交。失败保留草稿并呈现错误；成功只清理仍属于本次提交的正文/附件，不覆盖在途期间的新草稿。不要靠任意“有task就成功”，也不要改变后端授权/配置/排队语义。

范围是所有专家共享的补充入口，不是 data-analyst 专属；当前needs_input和运行中补充有直接组件覆盖，revising及reroute共享调用点需主线修改前纳入impact/回归选择。既有评审修订走另一函数，本轮未改也未将它的测试通过冒充本入口通过。没有修改runtime、公开类型或其它agent文件。

覆盖限于组件与mock API契约：不证明后端材料持久化、真实附件选择器、重开恢复或实际授权成功；未跑全量renderer/typecheck/fullcheck。未加入附件-only发送、任意语法或新专家专业题，避免扩大本轮范围。生产修复后应原样复跑冻结7项，并由主线决定真实QA和更大回归窗口。
