# Retro: fix-hard-gate-test-debt

日期：2026-08-17

## 做了什么
清硬门禁红簇：launcher 协议常量、audit redact、tools preview 常量、hub Vitest class。

## 教训
拆文件后漏导入会表现为「业务断言失败」；优先查 `ReferenceError` / 未绑定标识，再怀疑产品逻辑。
循环依赖模块（audit↔governance、remote↔adapters）应用 shared 或本地副本，勿顶层互 require。

## 后续
可归档 main 三轮结构 change；复发 ≥3 可 `/evolve` 升「split 漏绑定守卫」Skill。
