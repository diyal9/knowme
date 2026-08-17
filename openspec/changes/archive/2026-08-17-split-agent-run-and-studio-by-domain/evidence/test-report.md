# Test Report: split-agent-run-and-studio-by-domain

- 日期：2026-08-17
- 执行人：developer agent

## 定向测试

结果：**110 pass / 0 fail**（见 acceptance.md）

## 全量门禁

```bash
npm run lint  # architecture ok, lint ok（无 capability-hub-service WARN）
```

## 变更说明

- `agent-run-executor.ts` / `agent-run-manager.ts` 按域拆分为组合根 + 子模块；Studio 不拆分。
- 对外 require 路径与导出符号不变。
