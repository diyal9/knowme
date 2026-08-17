## Context

架构扫尾程序阶段：split-workbench-features-and-stores

## Goals / Non-Goals

**Goals:** 拆 workbench feature 与 store 下沉
**Non-Goals:** 还原旧壳；整盘重写 lib 算法。

## Decisions

1. 新架构：feature / domain / shared / thin IPC / 真模块主进程。
2. 禁止用 vm concat 规避 400 行。
3. 渲染只走 window.api。

## Electron 边界

Renderer → preload window.api → ipc/* → lib。主进程组合根显式 require。
