# Code Review: split-capability-hub-service-by-domain

## 结论

**通过** — 纯结构拆分，行为与导出契约保持不变。

## 优点

- map 单一来源（`capability-hub/map.ts`），消除 service 内重复
- 域工厂显式 deps，无共享 ctx 神对象
- 组合根清晰，171 行

## 风险 / 备注

- lifecycle.ts 仍 547 行，后续可再拆 import vs list（非本 change 范围）
- skill-task-catalog 测试改为读 `ipc.ts` 断言通道注册（通道名未变）

## 建议

- 无阻塞项
