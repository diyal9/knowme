---
name: feishu-doc-kb
description: >-
  列出飞书个人文件夹、知识库空间与记忆/最近编辑/阅读文档候选；选定后再深入读取。Use when
  the user asks to browse Feishu docs, knowledge base, folders, or recent files.
slash: /feishu-doc-kb
version: 1.0.0
disable-model-invocation: true
requiredTools: [feishu.doc_kb_suggest]
---

# 飞书文档 / 知识库

## 何时使用

- 用户要「查文档/知识库」「个人文件夹」「最近编辑/阅读」
- KnowMe 空态或快捷菜单触发 `docKbSuggest` 任务

## 时间范围

- 默认 **近 30 天（含今天）** 用于「最近编辑 / 最近阅读」
- 传给 `feishu.doc_kb_suggest` 的 `days` 参数（1–30）

## 阶段一：候选 suggest（首轮）

1. 确认飞书 user 授权；未授权时提示授权，**不要臆造文件夹或文档**
2. 立刻调用 `feishu.doc_kb_suggest`（`days` 见上），汇总：
   1. 个人云空间文件夹
   2. 可见知识库空间
   3. 依据个人记忆可能需要的文件（≤5）
   4. 最近自己编辑的文件（≤5）
   5. 最近自己阅读的文件（≤5）
3. 用简洁 Markdown 分区复述工具结果
4. **首轮禁止**澄清提问、**禁止读取正文**、**禁止编造**未出现的文件名
5. 不要先问关键词/空间/链接

## 阶段二：用户选定后深入

用户选定某一文件或给出新关键词后，再用：

- `feishu.read_doc`
- `feishu.search_docs`
- `feishu.list_wiki_nodes`

深入读取或检索。若用户要改某份文档，先确认目标与写入范围，再走审批写入。

## 禁止事项

- 禁止用会议总结 / 相关聊天 Workflow 替代本任务
- 禁止在首轮调用 read/search 读取正文
- 禁止编造文档名或链接

## 零结果

- 如实说明无候选，建议换关键词或检查授权范围
