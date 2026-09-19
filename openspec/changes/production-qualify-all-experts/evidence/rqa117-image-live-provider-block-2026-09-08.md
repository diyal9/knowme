# RQA117：生图专家真实 Provider 探针

## 执行

在隔离 QA 用户目录 `.tmp/qa-image-rqa116-live` 中执行 RQA69 的 `IP01`，不使用生产用户数据，也不绕过连接器密钥保护：

```text
node scripts/expert-qualification-live.js \
  --suite openspec/changes/production-qualify-all-experts/skill-evals/rqa69-image-producer-qualification/evals.json \
  --case IP01 \
  --user-data .tmp/qa-image-rqa116-live \
  --out .tmp/rqa116-ip01.json
```

## 结果

- lifecycle：`0/1` 通过，`environmentBlocked=1`。
- 任务没有进入 Provider 执行，未生成图片成果，也未进入专业质量评审。
- 阻断原因：`系统安全存储当前不可用，未保存任何明文密钥`。
- 资格脚本将该情况标记为 `configuration_required / enable_secure_storage`，并明确“不绕过安全存储，也未保存明文密钥”。
- 当前生图路线仍不能标记为 `executionReady` 或 `professionallyQualified`。

## 结论

这是当前机器的资格环境阻断，不是生图 Agent 成功或失败的专业质量结论。平台正确选择了停止而不是伪造图片、查找文档或把 Prompt/URL 当成成果。需要在支持系统安全存储并提供有效 Pango Provider 的环境中重跑 RQA69 全套生命周期。
