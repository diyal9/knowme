# RQA170：Electron 系统安全存储直接探测

日期：2026-09-09

## 目的

确认真实资格阻塞是否由 KnowMe 加载时机造成，而不是凭据配置本身不存在。

## 探测

在仓库当前 Electron 运行时中启动隔离 KnowMe 进程，并在主进程 `app.isReady()` 之后直接读取：

```text
safeStorage.isEncryptionAvailable() = false
app.isReady() = true
app.getName() = KnowMe
```

生产设置目录的只读检查同时确认：

- `settings.json` 存在 `apiKeyEnc`；
- 不存在明文 `apiKey`；
- Provider 为 DashScope，模型为 `qwen3.8-flash`。

## 结论

本次排除了“过早读取 safeStorage”的假设。当前 Electron/Windows 环境无法提供系统安全存储，因此隔离资格进程不能解密生产 API Key。运行时保持安全边界：不写入明文密钥、不复制明文密钥、不伪造模型结果，并将任务置为 `needs_input / configuration_required`。

这仍不是专家专业能力通过证据。完成真实资格前，必须在系统安全存储可用的正式运行环境中重新输入或解锁 Provider Key，并重跑六个保留专家的真实套件。
