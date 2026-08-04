# Spec: final-prompt-preview

## 最终提示词拼接
- WHEN 用户在编辑某文件时打开「最终提示词预览」THEN 主进程复用 buildSystemContent/buildChatMessages 拼出发送给模型的完整内容
- AND 拼接包含：固定底座 + 用户偏好（若有）+ 片段/记忆上下文（若有）+ `/技能` 引用正文 + 当前文件正文
- WHEN 正文含 `/slash` 引用 THEN 预览中体现被注入的片段正文

## 展示与复制
- WHEN 预览生成 THEN 分段可读展示（system / context / user）
- WHEN 用户点击复制 THEN 将最终提示词文本写入剪贴板并给出反馈
