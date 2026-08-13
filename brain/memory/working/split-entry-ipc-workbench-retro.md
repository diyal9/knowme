# Retro: split-entry-ipc-workbench

## 做对了什么

- 按 marker 连续簇 strangler，事故面可控
- deps 注入 + 合同测试改查 `src/ipc`，避免「迁走后测试仍盯 main」
- 大簇（ai-generate）单独模块，不相邻通道不强拼

## 下次注意

- 迁出前先改合同测试目标路径，减少一轮失败
- helpers 与 handler 混排时优先留 helper、只裁 handler
- 收益递减后及时验收归档，不在本 Story 硬拆 window/tray

日期：2026-08-13
