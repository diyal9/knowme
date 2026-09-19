# RQA19 provideInput 独立回归收尾

2026-09-06。仅新增边界 spec 和本报告；生产与原测试未改。没有真实任务/API/QA调用、fullcheck或全量类型检查。原红测报告保留：7项旧源2绿5红，不覆盖历史。

## 最终实跑

`node node_modules/vitest/vitest.mjs run --config vitest.config.ts src/renderer/features/expert/rqa19-provide-input.spec.tsx src/renderer/features/expert/rqa19-provide-input-boundaries.spec.tsx src/renderer/features/expert/expert-task-room.spec.tsx`

**79/79通过，3文件，exit 0**：原冻结7项、新增7项、既有专家房65项。真实组件与store，仅mock preload API，不直接调用组件内部函数。新增测试首次与原7项合跑14绿；之后仅给3个mock函数补payload类型参数，断言未变，再跑得到上述79绿。

| 文件 | SHA256 |
|---|---|
| 新边界7项（最终冻结） | `4A299017D7AAD05C3FE9AEEDFAE8F1695C0A76D94803B3E18BBDD45B58CC475F` |
| 原冻结7项，未变 | `5DA36438BF463D18E706B79CB85394F9D8F18EA016D0DAAA41753BCF40E04EE0` |
| 原专家房65项，未变 | `BFAE3564F5E121017A2C21837106837B7937586995F2D57B3C65227180AA01CA` |
| ExpertTaskRoom.tsx（主线补丁） | `64514F96DFAAE0EA6D154D83203BD9052C4240948E4BE52CA21E85AADB80668C` |

新增文件：`src/renderer/features/expert/rqa19-provide-input-boundaries.spec.tsx`。

## 新增有界控制

- needs_input / running：连续提交只允许一个在途请求；明确失败后保留正文/附件且可重新提交，锁不会永久残留。
- needs_input / running：空正文+附件可从真实唯一composer发送，payload为note空串+materials；成功后清理已交附件。
- reroute：点击真实“改用飞书内容继续”按钮，只提交路径确认及action=reroute，不提交或消费composer草稿/附件。这里不表示飞书授权已经实际完成。
- 同名替换：旧请求在途期间替换文本内容或图片dataUrl，成功后只清理旧正文，保留同名新版本；在途payload仍绑定原版本。

## 补丁只读复审

`ExpertTaskRoom.tsx:412` 起：提交前捕获草稿与附件；`ok:true`、task存在且ID一致才按成功处理；API失败不消费草稿。附件经实际runtime支持的materials字段发送，未以忽略的attachments字段冒充送达。仅composer动作携带/消费草稿；reroute显式隔离。成功消费要求仍在原room且正文/附件内容仍对应本次提交。finally按请求身份释放ref，重复保护限定本组件的同任务在途调用。

在本轮指定边界及已有65项回归内，未发现剩余阻断项。未改变后端授权、配置拒绝、单飞排队或工具执行决策；没有按专家ID分支修复。

局限：不是跨窗口/组件重挂载的全局幂等证明；同名替换控制覆盖text与image内容版本，不穷尽其它附件元数据；未调用后端验证持久化，也未运行真实附件选择器、冷重开或API授权。主线六题真实执行与实际UI验收仍独立记录，不能用79绿代替专业资格或真实材料落盘证明。
