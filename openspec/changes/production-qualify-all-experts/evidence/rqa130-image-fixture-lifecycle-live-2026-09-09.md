# RQA130 生图专家本地同构生命周期复跑

日期：2026-09-09  
范围：`rqa100-image-fixture-qualification`，隔离 Electron 用户目录，无外部凭据。

## 结果

- `FIXTURE-IP01` 正常生成：`review`，真实 `generate_image` 工具回执、可解码 image artifact 和成果预览来源均已进入任务记录。
- `FIXTURE-IP02` 故障注入：`needs_input`，工具返回文本但无图片时没有创建成果，保留可重试闭环。
- `FIXTURE-IP03` 取消后重试：`review`，重试沿用原 Brief，未把取消轮当成成功成果。
- `FIXTURE-IP04` 退回修改：`review`，生成新版本并保留上一版与修改意见链。
- `FIXTURE-IP05` 验收后重开：`review`，生成新版本并保留旧版、重开意见和版本关系。

生命周期：`5/5`；`runtimeFailed=0`；`environmentBlocked=0`；异常轮 `runtimeNeedsInput=1`。

## 边界

这是平台运行时闭环证据，不是生图专业质量认证。夹具图片仅用于验证真实图片 payload 的解码、落盘、artifact 引用、预览回退和生命周期；画面审美、主体符合度、商业可用性仍需在安全存储可用且真实 Provider 可调用的环境中由独立评审完成。当前 `professionallyQualified=0`、`productionReady=false` 保持不变。

## 相关回归

- `src/renderer/features/expert/expert-task-room.spec.tsx` 新增本地图片 artifact 的专家房渲染回归：先在对话中显示缩略图，再打开统一预览对话框。
- 专家房定向 Renderer：`69/69` 通过。
