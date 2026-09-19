# RQA166：隔离资格任务继承加密 Provider 配置

日期：2026-09-09

## 结果

- 资格执行器从生产数据目录向隔离 QA 目录合并了 Provider 非敏感配置和 `apiKeyEnc`，没有复制 `apiKey` 明文。
- PM01 的 Electron 运行报告已识别 `provider=dashscope`、`model=qwen3.8-flash`，证明隔离目录配置种子生效。
- 任务仍在模型调用前进入 `needs_input / configuration_required`：当前 Electron 环境无法通过系统安全存储解密 Provider API Key。

这次结果把之前“隔离目录无 AI 配置”的工具链缺口与真实的安全存储环境缺口区分开。没有绕过安全存储，也没有把配置存在误判为模型调用成功。

## 资格边界

PM01 未进入真实模型输出，不能计入生命周期通过或独立专业评审。六个保留专家仍为 `professionallyQualified=0`、`executionReady=false`、`productionReady=false`。

## 代码与回归

- `--source-user-data` 为显式选项，仅写入隔离目录。
- 只合并 Provider 配置与加密字段；目标目录中的明文敏感字段会被移除。
- 资格执行器定向测试 `15/15` 通过。
