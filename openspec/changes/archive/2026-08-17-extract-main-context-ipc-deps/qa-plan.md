# QA Plan: extract-main-context-ipc-deps

## Smoke Scope

- 启动工作台；托盘图标仍在；打开日志中心

## 反模式

- 是否仍存在 `src/main/scope.ts`
- `ipc-bind.ts` 是否还在偷偷 require 单例
